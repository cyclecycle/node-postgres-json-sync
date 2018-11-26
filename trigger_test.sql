BEGIN;

CREATE OR REPLACE FUNCTION PostgresJSONBinder_test_dbdataid1_Notify ()
 returns trigger
 language plpgsql
AS $$
declare
  channel text := TG_ARGV[0];
BEGIN
  PERFORM (
     with payload(data) AS
     (
       select NEW.data where NEW.id = 1
     )
     select pg_notify(channel, row_to_json(payload)::text)
       from payload
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS PostgresJSONBinder_test_dbdataid1_Trigger on "test_table";

CREATE TRIGGER PostgresJSONBinder_test_dbdataid1_Trigger
         AFTER UPDATE
            ON test_table
      FOR EACH ROW
       EXECUTE PROCEDURE PostgresJSONBinder_test_dbdataid1_Notify('PostgresJSONBinder_test_dbdataid1_Channel');

COMMIT;
