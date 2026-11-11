import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import ContactSupportModal from '../../components/modals/ContactSupportModal';
import { supabase } from '../../config/supabase';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  order: number;
}

const HelpSupport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContactMethod, setSelectedContactMethod] = useState<string>('');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  // Load FAQs from Supabase
  useEffect(() => {
    const channel = supabase
      .channel('faqs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'faqs',
          filter: 'is_active=eq.true',
        },
        () => {
          loadFaqs();
        },
      )
      .subscribe();

    loadFaqs();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadFaqs = async () => {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('order', { ascending: true })
        .order('question', { ascending: true });
      if (error) throw error;
      setFaqs((data ?? []) as FAQ[]);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      // Fallback: use empty array if table doesn't exist
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Topics', icon: 'HelpCircle' },
    { id: 'account', name: 'Account Management', icon: 'Users' },
    { id: 'transfers', name: 'Transfers & Payments', icon: 'RefreshCw' },
    { id: 'security', name: 'Security', icon: 'Shield' },
    { id: 'fees', name: 'Fees & Charges', icon: 'CreditCard' },
    { id: 'mobile', name: 'Mobile Banking', icon: 'Phone' },
    { id: 'deposits', name: 'Deposits & Withdrawals', icon: 'FileText' },
    { id: 'support', name: 'Customer Service', icon: 'MessageCircle' }
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <DashboardLayout
      title="Help & Support"
      subtitle="Get help and find answers to your questions"
    >
      <div className="space-y-6">
        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Live Chat</h3>
            <p className="text-sm text-gray-600 mb-4">Chat with our support team in real-time</p>
            <Button
              className="w-full"
              onClick={() => {
                setSelectedContactMethod('chat');
                setContactModalOpen(true);
              }}
            >
              Start Chat
            </Button>
            <p className="text-xs text-gray-500 mt-2">Available 24/7</p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📞</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Phone Support</h3>
            <p className="text-sm text-gray-600 mb-4">Speak directly with a support representative</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedContactMethod('phone');
                setContactModalOpen(true);
              }}
            >
              Request Call Back
            </Button>
            <p className="text-xs text-gray-500 mt-2">1-800-BANK-HELP</p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📧</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Email Support</h3>
            <p className="text-sm text-gray-600 mb-4">Send us a detailed message</p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedContactMethod('email');
                setContactModalOpen(true);
              }}
            >
              Send Email
            </Button>
            <p className="text-xs text-gray-500 mt-2">Response in 24 hours</p>
          </Card>
        </div>

        {/* Search and FAQ */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search for help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading FAQs...</p>
              </div>
            ) : filteredFAQs.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl text-gray-300 mx-auto mb-4">❓</span>
                <p className="text-gray-500">
                  {faqs.length === 0
                    ? "No FAQs available. Please contact support for assistance."
                    : "No FAQs found matching your search"}
                </p>
                {searchQuery && (
                  <p className="text-sm text-gray-400 mt-2">
                    Try adjusting your search terms or browse different categories
                  </p>
                )}
              </div>
            ) : (
              filteredFAQs.map((faq) => (
                <details key={faq.id} className="group border border-gray-200 rounded-lg">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                    <span className="font-medium text-gray-900">{faq.question}</span>
                    <span className="w-5 h-5 text-gray-400">▶</span>
                  </summary>
                  <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))
            )}
          </div>
        </Card>

        {/* Contact Support Section */}
        <Card className="p-6 text-center bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Still Need Help?</h3>
            <p className="text-gray-600 mb-6">
              Can't find what you're looking for? Our support team is here to help you with any questions or concerns.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setSelectedContactMethod('general');
                  setContactModalOpen(true);
                }}
                className="px-8 py-3"
              >
                <span className="w-4 h-4 mr-2">💬</span>
                Contact Support
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedContactMethod('urgent');
                  setContactModalOpen(true);
                }}
                className="px-8 py-3"
              >
                <span className="w-4 h-4 mr-2">⚠️</span>
                Urgent Issue
              </Button>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Average response time: 2 hours for urgent issues, 24 hours for general inquiries
            </p>
          </div>
        </Card>

        {/* Additional Resources */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'User Guide',
                description: 'Complete guide to using our banking platform',
                link: '#'
              },
              {
                title: 'Security Center',
                description: 'Learn about keeping your account secure',
                link: '#'
              },
              {
                title: 'Mobile App Guide',
                description: 'How to use our mobile banking app',
                link: '#'
              },
              {
                title: 'Fee Schedule',
                description: 'Complete list of fees and charges',
                link: '#'
              },
              {
                title: 'Service Status',
                description: 'Check current system status and outages',
                link: '#'
              },
              {
                title: 'Video Tutorials',
                description: 'Step-by-step video guides',
                link: '#'
              },
            ].map((resource) => (
              <a
                key={resource.title}
                href={resource.link}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center mb-3">
                  <span className="w-5 h-5 text-blue-600 mr-2">📄</span>
                  <h4 className="font-medium text-gray-900">{resource.title}</h4>
                </div>
                <p className="text-sm text-gray-600">{resource.description}</p>
              </a>
            ))}
          </div>
        </Card>
      </div>

      {/* Contact Support Modal */}
      {contactModalOpen && (
        <ContactSupportModal
          isOpen={contactModalOpen}
          onClose={() => {
            setContactModalOpen(false);
            setSelectedContactMethod('');
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default HelpSupport;
