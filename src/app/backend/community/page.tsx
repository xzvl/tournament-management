'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface User {
  user_id: number;
  username: string;
  user_role: string;
}

interface Community {
  community_id?: number;
  name: string;
  short_name: string;
  logo?: string;
  cover?: string;
  location?: string;
  province?: string;
  city?: string;
  to_id?: string;
}

function CommunityManagementInner() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectFrom = searchParams.get('redirect');

  const [formData, setFormData] = useState<Community>({
    name: '',
    short_name: '',
    logo: '',
    cover: '',
    location: '',
    province: '',
    city: ''
  });

  useEffect(() => {
    checkAuthAndLoadCommunity();
  }, []);

  const checkAuthAndLoadCommunity = async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      // Verify auth and get current user
      const authResponse = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const authData = await authResponse.json();

      if (!authData.success) {
        localStorage.removeItem('authToken');
        router.push('/backend/login');
        return;
      }

      setCurrentUser(authData.user);

      // Load user's community
      const communityResponse = await fetch('/api/community', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const communityData = await communityResponse.json();

      if (communityData.success && communityData.data) {
        setCommunity(communityData.data);
        setFormData({
          name: communityData.data.name || '',
          short_name: communityData.data.short_name || '',
          logo: communityData.data.logo || '',
          cover: communityData.data.cover || '',
          location: communityData.data.location || '',
          province: communityData.data.province || '',
          city: communityData.data.city || ''
        });
        // Set preview URLs for existing images
        setLogoPreview(communityData.data.logo || '');
        setCoverPreview(communityData.data.cover || '');
      }

    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('authToken');

    try {
      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('short_name', formData.short_name);
      formDataToSend.append('location', formData.location || '');
      formDataToSend.append('province', formData.province || '');
      formDataToSend.append('city', formData.city || '');
      
      // Add files if selected
      if (logoFile) {
        formDataToSend.append('logo', logoFile);
      }
      if (coverFile) {
        formDataToSend.append('cover', coverFile);
      }

      const method = community?.community_id ? 'PUT' : 'POST';
      const response = await fetch('/api/community', {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type for FormData - let browser set it
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (data.success) {
        setCommunity(data.community);
        // Update form data with returned URLs
        setFormData(prev => ({
          ...prev,
          logo: data.community.logo || '',
          cover: data.community.cover || ''
        }));
        setLogoPreview(data.community.logo || '');
        setCoverPreview(data.community.cover || '');
        setLogoFile(null);
        setCoverFile(null);
        setSuccess(community?.community_id ? 'Community updated successfully!' : 'Community created successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save community');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      if (type === 'logo') {
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
      } else {
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
      }
      setError(''); // Clear any previous errors
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin backend-spinner rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Community Management</h1>
                <p className="text-gray-600">
                  {community?.community_id ? 'Update your community information' : 'Create your community'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Redirect Notice */}
        {(redirectFrom || !community) && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Community Setup Required
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    {redirectFrom === 'judges' ? 
                      'You need to set up your community first before you can manage judges.' :
                      'Please create your community to access tournaments, judges, and other features.'
                    }
                  </p>
                  <p className="mt-1">
                    Fill out the form below to get started with your Beyblade community.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Community Form */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {community?.community_id ? 'Edit Community' : 'Create Community'}
            </h2>
            <p className="text-gray-600 mt-1">
              Manage your Beyblade community information and details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Community Name */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Community Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Manila Beyblade Masters"
                  required
                />
              </div>

              {/* Short Name */}
              <div>
                <label htmlFor="short_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Short Name/Abbreviation *
                </label>
                <input
                  type="text"
                  id="short_name"
                  name="short_name"
                  value={formData.short_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MBM"
                  maxLength={20}
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SM Mall of Asia"
                />
              </div>

              {/* City */}
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Manila"
                />
              </div>

              {/* Province */}
              <div>
                <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">
                  Province/State
                </label>
                <input
                  type="text"
                  id="province"
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Metro Manila"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
                  Community Logo
                </label>
                <input
                  type="file"
                  id="logo"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'logo')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {logoPreview && (
                  <div className="mt-2">
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="w-16 h-16 object-cover rounded-full"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG/GIF</p>
              </div>

              {/* Cover Image Upload */}
              <div>
                <label htmlFor="cover" className="block text-sm font-medium text-gray-700 mb-2">
                  Cover Image
                </label>
                <input
                  type="file"
                  id="cover"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cover')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {coverPreview && (
                  <div className="mt-2">
                    <img
                      src={coverPreview}
                      alt="Cover Preview"
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG/GIF</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <div className="flex items-center">
                    <div className="animate-spin backend-spinner rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  community?.community_id ? 'Update Community' : 'Create Community'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Community Preview */}
        {(formData.name || formData.short_name) && (
          <div className="bg-white rounded-lg shadow-sm border mt-8">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
            </div>
            <div className="p-6">
              {coverPreview && (
                <div className="mb-4">
                  <img
                    src={coverPreview}
                    alt="Community Cover"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                </div>
              )}
              <div className="flex items-center space-x-4">
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Community Logo"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{formData.name}</h4>
                  <p className="text-gray-600">({formData.short_name})</p>
                  {formData.location && (
                    <p className="text-sm text-gray-500 mt-1">📍 {formData.location}</p>
                  )}
                  {(formData.city || formData.province) && (
                    <p className="text-sm text-gray-500">
                      {[formData.city, formData.province].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CommunityManagement() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading...</div>}>
      <CommunityManagementInner />
    </Suspense>
  );
}