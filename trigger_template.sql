BEGIN;

CREATE OR REPLACE FUNCTION FUNCNAME ()
 returns trigger
 language plpgsql
AS $$
declare
  channel text := TG_ARGV[0];
BEGIN
  PERFORM (
     with payload(FIELDNAME) AS
     (
       select NEW.FIELDNAME where NEW.IDFIELD = ROWID
     )
     select pg_notify(channel, row_to_json(payload)::text)
       from payload
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS TRIGGERNAME on "SCHEMANAME";

CREATE TRIGGER TRIGGERNAME
         AFTER UPDATE
            ON SCHEMANAME
      FOR EACH ROW
       EXECUTE PROCEDURE FUNCNAME('CHANNELNAME');

COMMIT;