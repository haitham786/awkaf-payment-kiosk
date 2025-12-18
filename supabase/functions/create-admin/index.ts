import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate a cryptographically secure random password
 * Requirements: 16+ chars, uppercase, lowercase, numbers, symbols
 */
function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  // Ensure at least one character from each category
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  
  let password = '';
  
  // Add one from each required category
  password += uppercase[randomBytes[0] % uppercase.length];
  password += lowercase[randomBytes[1] % lowercase.length];
  password += numbers[randomBytes[2] % numbers.length];
  password += symbols[randomBytes[3] % symbols.length];
  
  // Fill the rest with random characters from all categories
  for (let i = 4; i < length; i++) {
    password += allChars[randomBytes[i] % allChars.length];
  }
  
  // Shuffle the password to randomize position of required characters
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = randomBytes[i % randomBytes.length] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }
  
  return passwordArray.join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    // Check if user is super admin (server-side validation)
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (!roles) {
      console.error('User is not super admin:', user.id);
      throw new Error('Only super admins can create admin users');
    }

    const { email } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Generate a secure random password (not stored, only returned once)
    const temporaryPassword = generateSecurePassword(16);
    
    console.log('Creating admin account for:', email);

    // Create the user with service role (bypasses RLS)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: email.split('@')[0],
      }
    });

    if (createError) {
      console.error('User creation error:', createError);
      throw createError;
    }

    // Explicitly create profile (trigger might not fire for admin.createUser)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{ 
        id: newUser.user.id, 
        email: email,
        full_name: email.split('@')[0],
        first_login: true
      }]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't throw, profile might already exist from trigger
    }

    // Add admin role using service role (bypasses RLS)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: newUser.user.id, role: 'admin' }]);

    if (roleError) {
      console.error('Role assignment error:', roleError);
      throw roleError;
    }

    console.log('Admin account created successfully for:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser.user,
        // Return the temporary password ONCE - must be communicated securely to the new admin
        temporaryPassword: temporaryPassword,
        message: `Admin account created for ${email}. The temporary password is shown below - please share it securely with the new admin.`,
        securityNote: 'This password is shown only once and must be changed on first login.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in create-admin:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
