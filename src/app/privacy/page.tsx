import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Privacy Policy - Liberty Surveys',
  description: 'Privacy Policy for Liberty Surveys',
};

export default function PrivacyPage() {
  redirect('https://www.dailytrendsmedia.com/privacy-policy/');
}
