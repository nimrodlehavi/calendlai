import Booking from "../../components/booking";

export default function BookingPage({ username, slug }: any) {
  return <Booking username={username} slug={slug} />;
}

export async function getServerSideProps({ params }: any) {
  return { props: { username: params.username, slug: params.slug } };
}
