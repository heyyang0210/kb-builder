Created by 赵忠源 on 十月 17, 2024

#   [YDBRD-34293: BINARY Research](#ydbrd-xxxx-xxx-researchxxx-特性调研)  

  [#YDBRD-34293 【mysql兼容】支持BINARY 数据类型存储](https://pingcode.yasdb.com/pjm/items/670e5c28e489dd0868f7fd4e?)  

##   [1. Overview（概述）](#1-overview概述)  

兼容支持Mysql数据库Binary数据类型

Mysql Binary类型文档 ：    [https://dev.mysql.com/doc/refman/5.7/en/binary-varbinary.html](https://dev.mysql.com/doc/refman/5.7/en/binary-varbinary.html)  

##   [2. Features（功能特性）](#2-features功能特性)  

数据类型

BINARY类型为固定长度的二进制字符串，为非字符字符串，无对应字符集信息

数据格式BINARY (M)为固定长度的二进制字符串，M表示最多能存储的字节数，取值范围是0~255个字节。如果未指定(M)，表示只能存储1个字节。

若字节值不足M，将在末尾补0x00，与CHAR类型类似

不启用Strict SQL Mode时，为超过列最大长度的BINARY列分配值，该值将被截断并生成警告。启用Strict SQL Mode时，超过最大长度将报错。

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

3.1 规格差异

Yashan兼容模式下已实现BINARY，以RAW形式实现，目前存在较多差异

|  
|  
|  
|  
|  
|  
|  
|
|---|---|---|---|---|---|---|
|BINARY  [(M)]|1.实现时，映射为yashan的RAW类型,2.实现时，列宽度范围0~255字节，256字节及以上报错,3.省略M时长度为1字节,4.mysql的binary类型会补0x00，现阶段实现先不补0x00,5.同义词：  CHAR BYTE，后面不能跟宽度，固定映射成RAW(1)|否|  [MYSQL-The BINARY and VARBINARY Types](https://dev.mysql.com/doc/refman/5.7/en/binary-varbinary.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BINARY(即RAW),  
,char?,建议对齐,create table代码带出|是|1.Mysql：,BINARY[(M)]：0~255 bytes,长度是定长，但映射成raw的话求长度是变长长度,底层为二进制，输入时可以为任意字符，发送时以无字符集信息的二进制字节流发送到服务端,  
,2.Yashan：,底层用raw类型表示，raw的column size范围是[1,8000],实现上，超过255是否报错需确认，0是否支持需确认,底层为十六进制，会校验16进制字符|


Binary映射为raw，目前仅能为16进制字符，其他将报错；





3.2  Mysql定长变长数据类型差异

cast/convert的结果类型为变长类型

![image.png](https://pingcode.yasdb.com/atlas/files/public/673c76b08970c2af4f53b5e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQUFBUUFBQUFBQUFBQUFBQ0FBSUFnQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBSUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5NTIsImV4cCI6MTc4MjQ2Njc1Mn0.V_B0Q2Udwhksqk641XtsSiyHWjDQy3xjNMKWFuQngwQ)

![image.png](https://pingcode.yasdb.com/atlas/files/public/673c76be8970c2af4f53b5e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQUFBUUFBQUFBQUFBQUFBQ0FBSUFnQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBSUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5NTIsImV4cCI6MTc4MjQ2Njc1Mn0.V_B0Q2Udwhksqk641XtsSiyHWjDQy3xjNMKWFuQngwQ)



verify类型推导上已经将类型推导为不定长类型，exec处难以确定原始类型

Char/nChar

0x00不参与到计算、比较中

![image.png](https://pingcode.yasdb.com/atlas/files/public/673c73a88970c2af4f53b5e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQUFBUUFBQUFBQUFBQUFBQ0FBSUFnQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBSUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5NTIsImV4cCI6MTc4MjQ2Njc1Mn0.V_B0Q2Udwhksqk641XtsSiyHWjDQy3xjNMKWFuQngwQ)

Binary/varBinary 

0x00参与到计算、比较中

![image.png](https://pingcode.yasdb.com/atlas/files/public/673c74ff8970c2af4f53b5e4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFCQUFBQUFBQVFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQUFBUUFBQUFBQUFBQUFBQ0FBSUFnQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBSUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5NTIsImV4cCI6MTc4MjQ2Njc1Mn0.V_B0Q2Udwhksqk641XtsSiyHWjDQy3xjNMKWFuQngwQ)

3.3 基础函数差异

BINARY类型与基础函数（+-*/、comp、round、trunc、and、or、xor、mod）运算时存在差异，主要原因为mysql下无number类型，基本以double类型为基准，大部分类型推导需要重新对齐。

其他函数类型推导上需在对应函数调整时对齐

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*