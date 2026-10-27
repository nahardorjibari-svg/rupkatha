import React, { useState } from 'react';
import { CompanyLogo } from './CompanyLogo';
import { Menu, X, Phone, Mail } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/company';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Dynamic Company Logo & Name */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('top');
          }}
          className="focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg p-1 transition-transform active:scale-98"
        >
          <CompanyLogo size="md" />
        </a>

        {/* Right: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => scrollToSection('top')}
            className="hover:text-[#0F8B8D] transition-colors py-1 cursor-pointer"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="hover:text-[#0F8B8D] transition-colors py-1 cursor-pointer"
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="hover:text-[#0F8B8D] transition-colors py-1 cursor-pointer"
          >
            Contact Us
          </button>

          {/* Quick Support Badge */}
          <a
            href={`tel:${COMPANY_CONFIG.customerService.phone}`}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 text-[#0F8B8D] border border-teal-200/70 text-xs font-semibold hover:bg-teal-100 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{COMPANY_CONFIG.customerService.displayPhone}</span>
          </a>
        </nav>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-soft-lg animate-in slide-in-from-top-2 duration-200">
          <button
            type="button"
            onClick={() => scrollToSection('top')}
            className="w-full text-left py-2 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0F8B8D] rounded-lg transition-colors"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="w-full text-left py-2 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0F8B8D] rounded-lg transition-colors"
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="w-full text-left py-2 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0F8B8D] rounded-lg transition-colors"
          >
            Contact Us
          </button>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 text-xs text-slate-600">
            <a
              href={`mailto:${COMPANY_CONFIG.customerService.email}`}
              className="flex items-center gap-2 py-1 text-teal-700 font-medium"
            >
              <Mail className="w-4 h-4 text-teal-600" />
              <span>{COMPANY_CONFIG.customerService.email}</span>
            </a>
            <a
              href={`tel:${COMPANY_CONFIG.customerService.phone}`}
              className="flex items-center gap-2 py-1 text-teal-700 font-medium"
            >
              <Phone className="w-4 h-4 text-teal-600" />
              <span>{COMPANY_CONFIG.customerService.displayPhone}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
