// Node.js script to remove riders with N/A deployment dates
// Run with: node remove_na_riders.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function removeNaRiders() {
  try {
    console.log('🔍 Finding riders with N/A deployment dates...')
    
    // First, identify riders with N/A deployment dates
    const { data: naRiders, error: fetchError } = await supabase
      .from('riders')
      .select('*')
      .or('deployment_date.eq.N/A,deployment_date.is.null')
    
    if (fetchError) {
      console.error('❌ Error fetching riders:', fetchError)
      return
    }
    
    if (!naRiders || naRiders.length === 0) {
      console.log('✅ No riders with N/A deployment dates found!')
      return
    }
    
    console.log(`📊 Found ${naRiders.length} riders with N/A deployment dates:`)
    
    // Display riders to be deleted
    naRiders.forEach(rider => {
      console.log(`  - ID: ${rider.rider_id || 'N/A'}, Name: ${rider.rider_name || 'N/A'}, Hub: ${rider.operator_hub || 'N/A'}`)
    })
    
    // Confirm deletion
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    const answer = await new Promise(resolve => {
      rl.question(`\n⚠️  Are you sure you want to delete ${naRiders.length} riders? (yes/no): `, resolve)
    })
    
    rl.close()
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.')
      return
    }
    
    console.log('\n🗑️  Deleting riders...')
    
    // Delete riders with N/A deployment dates
    const { data: deletedRiders, error: deleteError } = await supabase
      .from('riders')
      .delete()
      .or('deployment_date.eq.N/A,deployment_date.is.null')
      .select()
    
    if (deleteError) {
      console.error('❌ Error deleting riders:', deleteError)
      return
    }
    
    console.log(`✅ Successfully deleted ${deletedRiders.length} riders`)
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...')
    
    const { count: totalRiders } = await supabase
      .from('riders')
      .select('*', { count: 'exact', head: true })
    
    const { count: remainingNa } = await supabase
      .from('riders')
      .select('*', { count: 'exact', head: true })
      .or('deployment_date.eq.N/A,deployment_date.is.null')
    
    console.log(`📈 Total riders remaining: ${totalRiders || 0}`)
    console.log(`📈 Riders with N/A deployment dates remaining: ${remainingNa || 0}`)
    
    if ((remainingNa || 0) === 0) {
      console.log('🎉 Cleanup completed successfully!')
    } else {
      console.log('⚠️  Some riders with N/A deployment dates still remain.')
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

removeNaRiders()
