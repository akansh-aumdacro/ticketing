
UPDATE public.profiles SET employee_id = NULL WHERE employee_id IS NOT NULL AND btrim(employee_id) = '';
UPDATE public.profiles SET username = NULL WHERE username IS NOT NULL AND btrim(username) = '';
UPDATE public.profiles SET contact = NULL WHERE contact IS NOT NULL AND btrim(contact) = '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_username text;
  v_employee_id text;
  v_contact text;
BEGIN
  v_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''), NEW.email);
  v_username := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))), '');
  v_employee_id := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'employee_id', '')), '');
  v_contact := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'contact', '')), '');

  INSERT INTO public.profiles (user_id, name, username, employee_id, contact)
  VALUES (NEW.id, v_name, v_username, v_employee_id, v_contact);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;
