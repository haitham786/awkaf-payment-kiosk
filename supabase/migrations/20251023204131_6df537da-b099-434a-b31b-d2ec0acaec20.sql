-- Delete users who were added as admins but have no role assigned
DELETE FROM auth.users WHERE email IN ('haitham@onelight-media.net', 'haitham@albinaa-realestate.com', 'call6969@gmail.com');