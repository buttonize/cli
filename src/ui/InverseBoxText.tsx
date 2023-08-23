import { Newline, Text } from 'ink'
import React from 'react'

export const InverseBoxText: React.FC<{ children: string }> = ({
	children
}) => {
	return (
		<>
			<Text inverse>
				{new Array(children.length + 2)
					.fill(1)
					.map(() => ' ')
					.join('')}
				<Newline /> {children} <Newline />
				{new Array(children.length + 2)
					.fill(1)
					.map(() => ' ')
					.join('')}
			</Text>
		</>
	)
}
