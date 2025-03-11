// supabase/functions/create-admin-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ieadbzgzsjxcafgzbysu.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Admin user credentials
    const adminEmail = 'admin@admin.com'
    const adminPassword = 'admin123'

    // Check if admin user already exists
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers()
      .then(response => {
        const adminUser = response.users.find(user => user.email === adminEmail);
        return { data: adminUser ? { id: adminUser.id } : null, error: null };
      })
      .catch(error => ({ data: null, error }))

    if (searchError) {
      console.error('Error checking for existing admin:', searchError)
      throw searchError
    }

    let userId

    if (existingUsers) {
      console.log('Admin user already exists')
      userId = existingUsers.id
    } else {
      // Create admin user if it doesn't exist
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      })

      if (createError) {
        console.error('Error creating admin user:', createError)
        throw createError
      }

      console.log('Admin user created successfully')
      userId = newUser.user.id
    }

    // Ensure admin role is assigned
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'admin',
      })

    if (roleError) {
      console.error('Error assigning admin role:', roleError)
      throw roleError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin user created/verified successfully',
        adminEmail,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})