SELECT tgname, tgtype, tgargs, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'kpi_records'
  AND NOT t.tgisinternal;
