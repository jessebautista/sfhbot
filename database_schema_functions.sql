-- SQL functions to support database schema discovery
-- These functions should be created in the Supabase database to enable better schema introspection

-- Function to get detailed table schema information
CREATE OR REPLACE FUNCTION get_table_schema(table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    column_info jsonb[];
    pk_columns text[];
    col_record record;
BEGIN
    -- Get column information from information_schema
    FOR col_record IN
        SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            tc.constraint_type
        FROM 
            information_schema.columns c
        LEFT JOIN 
            information_schema.key_column_usage kcu 
            ON c.table_name = kcu.table_name 
            AND c.column_name = kcu.column_name
            AND c.table_schema = kcu.table_schema
        LEFT JOIN 
            information_schema.table_constraints tc 
            ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_schema = tc.table_schema
        WHERE 
            c.table_name = $1
            AND c.table_schema = 'public'
        ORDER BY 
            c.ordinal_position
    LOOP
        -- Build column info
        column_info := column_info || jsonb_build_object(
            'name', col_record.column_name,
            'type', col_record.data_type,
            'nullable', col_record.is_nullable = 'YES',
            'default_value', col_record.column_default,
            'max_length', col_record.character_maximum_length,
            'precision', col_record.numeric_precision,
            'scale', col_record.numeric_scale,
            'is_primary_key', col_record.constraint_type = 'PRIMARY KEY',
            'is_foreign_key', col_record.constraint_type = 'FOREIGN KEY'
        );
        
        -- Collect primary key columns
        IF col_record.constraint_type = 'PRIMARY KEY' THEN
            pk_columns := pk_columns || col_record.column_name;
        END IF;
    END LOOP;
    
    -- Build final result
    result := jsonb_build_object(
        'table_name', table_name,
        'columns', column_info,
        'primary_keys', pk_columns,
        'discovered_at', now()
    );
    
    RETURN result;
END;
$$;

-- Function to get basic table information for multiple tables
CREATE OR REPLACE FUNCTION get_tables_info(table_names text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    table_name text;
    table_info jsonb;
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        -- Check if table exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $table_name
        ) THEN
            -- Get basic table info
            SELECT 
                jsonb_build_object(
                    'table_name', t.table_name,
                    'table_type', t.table_type,
                    'row_count', (
                        SELECT COALESCE(n_tup_ins - n_tup_del, 0)
                        FROM pg_stat_user_tables 
                        WHERE schemaname = 'public' 
                        AND relname = t.table_name
                    ),
                    'columns', (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'name', column_name,
                                'type', data_type,
                                'nullable', is_nullable = 'YES'
                            ) ORDER BY ordinal_position
                        )
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = t.table_name
                    ),
                    'searchable_columns', (
                        SELECT jsonb_agg(column_name ORDER BY ordinal_position)
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = t.table_name
                        AND data_type IN ('text', 'varchar', 'char', 'character varying')
                    )
                )
            INTO table_info
            FROM information_schema.tables t
            WHERE t.table_schema = 'public'
            AND t.table_name = table_name;
            
            result := result || table_info;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Function to test column existence and get alternative suggestions
CREATE OR REPLACE FUNCTION find_similar_columns(table_name text, target_column text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    similar_columns text[];
BEGIN
    -- Find columns with similar names using fuzzy matching
    SELECT array_agg(column_name ORDER BY 
        CASE 
            WHEN column_name = target_column THEN 1
            WHEN column_name ILIKE '%' || target_column || '%' THEN 2
            WHEN target_column ILIKE '%' || column_name || '%' THEN 3
            WHEN levenshtein(column_name, target_column) <= 3 THEN 4
            ELSE 5
        END
    )
    INTO similar_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = $1
    AND (
        column_name ILIKE '%' || target_column || '%' 
        OR target_column ILIKE '%' || column_name || '%'
        OR levenshtein(column_name, target_column) <= 3
    )
    LIMIT 10;
    
    result := jsonb_build_object(
        'table_name', table_name,
        'target_column', target_column,
        'exists', EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = target_column
        ),
        'similar_columns', COALESCE(similar_columns, ARRAY[]::text[]),
        'all_columns', (
            SELECT array_agg(column_name ORDER BY ordinal_position)
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
        )
    );
    
    RETURN result;
END;
$$;

-- Function to safely execute queries with column validation
CREATE OR REPLACE FUNCTION validate_query_columns(table_name text, columns_to_check text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    valid_columns text[] := ARRAY[]::text[];
    invalid_columns text[] := ARRAY[]::text[];
    col text;
BEGIN
    -- Check each column
    FOREACH col IN ARRAY columns_to_check
    LOOP
        IF EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = col
        ) THEN
            valid_columns := valid_columns || col;
        ELSE
            invalid_columns := invalid_columns || col;
        END IF;
    END LOOP;
    
    result := jsonb_build_object(
        'table_name', table_name,
        'valid_columns', valid_columns,
        'invalid_columns', invalid_columns,
        'has_invalid', array_length(invalid_columns, 1) > 0
    );
    
    RETURN result;
END;
$$;

-- Grant execute permissions (adjust as needed for your security model)
GRANT EXECUTE ON FUNCTION get_table_schema(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tables_info(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_columns(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_query_columns(text, text[]) TO anon, authenticated;

-- Create extension for fuzzy string matching if not exists
-- CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

COMMENT ON FUNCTION get_table_schema(text) IS 'Returns detailed schema information for a given table including columns, types, and constraints';
COMMENT ON FUNCTION get_tables_info(text[]) IS 'Returns basic information for multiple tables including row counts and column lists';
COMMENT ON FUNCTION find_similar_columns(text, text) IS 'Finds columns with names similar to a target column using fuzzy matching';
COMMENT ON FUNCTION validate_query_columns(text, text[]) IS 'Validates that specified columns exist in a table and returns valid/invalid lists';