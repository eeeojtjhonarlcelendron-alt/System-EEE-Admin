import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('VITE_SUPABASE_ANON_KEY')
)

def remove_na_riders():
    """Remove riders with N/A deployment dates from Supabase"""
    
    print("🔍 Finding riders with N/A deployment dates...")
    
    # First, identify riders with N/A deployment dates
    response = supabase.table('riders').select('*').or('deployment_date.eq.N/A,deployment_date.is.null').execute()
    
    if not response.data:
        print("✅ No riders with N/A deployment dates found!")
        return
    
    na_riders = response.data
    print(f"📊 Found {len(na_riders)} riders with N/A deployment dates:")
    
    # Display riders to be deleted
    for rider in na_riders:
        print(f"  - ID: {rider.get('rider_id', 'N/A')}, Name: {rider.get('rider_name', 'N/A')}, Hub: {rider.get('operator_hub', 'N/A')}")
    
    # Confirm deletion
    confirm = input(f"\n⚠️  Are you sure you want to delete {len(na_riders)} riders? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("❌ Deletion cancelled.")
        return
    
    print("\n🗑️  Deleting riders...")
    
    # Delete riders with N/A deployment dates
    delete_response = supabase.table('riders').delete().or('deployment_date.eq.N/A,deployment_date.is.null').execute()
    
    if delete_response.data:
        print(f"✅ Successfully deleted {len(delete_response.data)} riders")
    else:
        print(f"❌ Error deleting riders: {delete_response.error}")
    
    # Verify cleanup
    print("\n🔍 Verifying cleanup...")
    total_response = supabase.table('riders').select('rider_id', count='exact').execute()
    remaining_na_response = supabase.table('riders').select('rider_id', count='exact').or('deployment_date.eq.N/A,deployment_date.is.null').execute()
    
    total_riders = total_response.count or 0
    remaining_na = remaining_na_response.count or 0
    
    print(f"📈 Total riders remaining: {total_riders}")
    print(f"📈 Riders with N/A deployment dates remaining: {remaining_na}")
    
    if remaining_na == 0:
        print("🎉 Cleanup completed successfully!")
    else:
        print("⚠️  Some riders with N/A deployment dates still remain.")

if __name__ == "__main__":
    remove_na_riders()
