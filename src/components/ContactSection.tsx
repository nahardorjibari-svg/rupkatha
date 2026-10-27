import React from 'react';
import { Mail, Phone, Building2, Factory, Headphones } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/company';

export const ContactSection: React.FC = () => {
  return (
    <section id="contact" className="py-16 sm:py-24 bg-slate-50 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[#0F8B8D] border border-teal-200/70 text-xs font-semibold uppercase tracking-wider mb-3">
            <Headphones className="w-3.5 h-3.5" />
            <span>Factory Communications</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Contact &amp; Plant Locations
          </h2>
          <p className="mt-2 text-sm text-slate-600 font-bangla">
            যেকোনো জিজ্ঞাসা, অর্ডার ফলো-আপ বা সহায়তার জন্য আমাদের সাথে যোগাযোগ করুন
          </p>
        </div>

        {/* 3 Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Customer Service */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0F8B8D] flex items-center justify-center mb-5 ring-1 ring-teal-100 group-hover:scale-105 transition-transform">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Customer Service</h3>
              <p className="text-xs text-slate-500 font-bangla mb-4">কাস্টমার সার্ভিস ও মার্চেন্ডাইজিং সাপোর্ট</p>
              <div className="space-y-3 text-sm">
                <a
                  href={`mailto:${COMPANY_CONFIG.customerService.email}`}
                  className="flex items-center gap-3 text-slate-700 hover:text-[#0F8B8D] transition-colors group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:text-[#0F8B8D] group-hover/item:bg-teal-50 transition-colors shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="font-medium break-all">{COMPANY_CONFIG.customerService.email}</span>
                </a>

                <a
                  href={`tel:${COMPANY_CONFIG.customerService.phone}`}
                  className="flex items-center gap-3 text-slate-700 hover:text-[#0F8B8D] transition-colors group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:text-[#0F8B8D] group-hover/item:bg-teal-50 transition-colors shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-900">{COMPANY_CONFIG.customerService.displayPhone}</span>
                </a>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              Hours: 8:00 AM - 8:00 PM (GMT+6)
            </div>
          </div>

          {/* Card 2: Corporate Office */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 ring-1 ring-indigo-100 group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Corporate Office</h3>
              <p className="text-xs text-slate-500 font-bangla mb-4">কর্পোরেট প্রধান কার্যালয়</p>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {COMPANY_CONFIG.corporateOffice}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              Administrative &amp; Executive Headquarters
            </div>
          </div>

          {/* Card 3: Factory Unit */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-soft-sm hover:shadow-soft-md transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 ring-1 ring-blue-100 group-hover:scale-105 transition-transform">
                <Factory className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Factory Complex</h3>
              <p className="text-xs text-slate-500 font-bangla mb-4">কাটিং, সুইং, ফিনিশিং ও ওয়্যারহাউস ইউনিট</p>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {COMPANY_CONFIG.factory}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              Knit &amp; Woven Manufacturing Unit
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
