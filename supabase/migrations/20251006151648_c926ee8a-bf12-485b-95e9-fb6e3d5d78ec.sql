-- Refresh schema cache by notifying PostgREST
NOTIFY pgrst, 'reload schema';