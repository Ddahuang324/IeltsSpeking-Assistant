import { Flex } from 'antd';

const FieldItem = ({
	label,
	children,
	icon,
}: {
	label: React.ReactNode;
	children: React.ReactNode;
	icon?: React.ReactNode;
}) => {
	return (
		<Flex vertical gap={8}>
			<Flex gap={8} align='center'>
				{icon}
				<span
					style={{
						fontWeight: 500,
						fontSize: 14,
					}}
				>
					{label}
				</span>
			</Flex>
			{children}
		</Flex>
	);
};

export default FieldItem;
