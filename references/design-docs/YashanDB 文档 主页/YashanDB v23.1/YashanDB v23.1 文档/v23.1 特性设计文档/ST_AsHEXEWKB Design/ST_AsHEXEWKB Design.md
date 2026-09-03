Created by 文博浩, last modified on 五月 24, 2023

##   [1. Overview（概述）](#1-overview概述)  

返回一个HEXEWKB格式(EWKB对应的十六进制形式)的几何体文本。

语法：

```
ST_AsHEXEWKB(geom geometry, NDRorXDR string) return clob

```

##   [2. Features（功能特性）](#2-features功能特性)  

- 使用小端(NDR)或大端(XDR)编码。如果没有指定编码或输入错误编码，则使用NDR。
- 支持3d和4d，不会丢弃z-index、m-index。


参数类型：

- 参数1：geometry
- 参数2：char、varchar


返回类型：clob

Null值：

- geom为null返回null
- NDRorXDR为null返回null


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
geomAsHEXEWKB()

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

AnchorBase实现：调用commonGeomAsWKB。ST_AsEWKB函数中间过程已经拿到十六进制字符串，不需要再做转换。

PostGIS实现：在ST_AsEWKB实现的基础上实现，实现二进制字节流到十六进制字符串的转换。

```
char *convert_bytes_to_hex(uint8_t *ewkb, size_t size)
{
	size_t i;
	char *hexewkb;

	/* Convert the byte stream to a hex string using liblwgeom's deparse_hex function */
	hexewkb = malloc(size * 2 + 1);
	for (i=0; i&lt;size; ++i) deparse_hex(ewkb[i], &amp;hexewkb[i * 2]);
	hexewkb[size * 2] = '\0';

	return hexewkb;
}

/**
 * Given one byte, populate result with two byte representing
 * the hex number.
 *
 * Ie. deparse_hex( 255, mystr)
 *		-&gt; mystr[0] = 'F' and mystr[1] = 'F'
 *
 * No error checking done
 */
void
deparse_hex(uint8_t str, char *result)
{
	int	input_high;
	int  input_low;
	static char outchr[]=
	{
		"0123456789ABCDEF"
	};

	input_high = (str&gt;&gt;4);
	input_low = (str &amp; 0x0F);

	result[0] = outchr[input_high];
	result[1] = outchr[input_low];

}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  