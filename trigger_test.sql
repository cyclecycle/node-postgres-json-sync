begin;

create or replace function notify_data_change ()
 returns trigger
 language plpgsql
as $$
declare
  channel text := TG_ARGV[0];
begin
  PERFORM (
     with payload(data) as
     (
       select NEW.data where NEW.id = 1
     )
     select pg_notify(channel, row_to_json(payload)::text)
       from payload
  );
  RETURN NULL;
end;
$$;

DROP TRIGGER IF EXISTS notify_data_change3 on "test";

CREATE TRIGGER notify_data_change3
         AFTER UPDATE
            ON test
      FOR EACH ROW
       EXECUTE PROCEDURE notify_data_change('data_change');

commit;