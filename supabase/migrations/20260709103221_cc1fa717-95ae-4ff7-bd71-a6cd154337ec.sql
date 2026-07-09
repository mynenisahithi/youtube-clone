
ALTER FUNCTION public.auto_delete_disliked_comment() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.validate_comment() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_delete_disliked_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_comment() FROM PUBLIC, anon, authenticated;
