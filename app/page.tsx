'use client';
import { redirect } from 'next/navigation'

const Home = () => {
  redirect('/live')
  return null;
}

export default Home;
