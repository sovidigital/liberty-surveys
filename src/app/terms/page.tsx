import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Terms of Use - Liberty Surveys',
  description: 'Terms of Use for Liberty Surveys',
};

export default function TermsPage() {
  redirect('https://www.dailytrendsmedia.com/terms-of-service/');
}
