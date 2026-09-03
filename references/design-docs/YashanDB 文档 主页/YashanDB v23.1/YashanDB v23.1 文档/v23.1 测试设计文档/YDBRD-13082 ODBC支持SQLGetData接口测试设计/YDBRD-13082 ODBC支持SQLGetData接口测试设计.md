Created by 刘清萍, last modified on 十二月 04, 2023

# 1.   **概述**

描述odbc中函数SQLGetData的测试设计

# 2.   **需求分析**

**sr链接：**    [[YDBRD-13082] 【驱动】ODBC支持SQLGetData接口 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13082)  

  [YDBRD-13082](https://jira.yasdb.com/browse/YDBRD-13082?src=confmacro)    **-**  **【驱动】ODBC支持SQLGetData接口**  **完成**

该函数常用于ODBC框架不预先绑定直接获取数据，相比于绑定流程获取结果集更简单

具体参数：

![](https://pingcode.yasdb.com/atlas/files/public/67396974a1ad9a3311dc76a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY3NjYsImV4cCI6MTc4MjIxNzU2Nn0.CDOpwFlNtt0wy0xEWr_zBXDhXRoC3oGYazZ6WtF2SRM)

# 3.   **测试设计方法**   

  主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

|函数名称|测试点|数据类型|是否符合预期|备注|
|---|---|---|---|---|
|*get_data_01*|*不同数据类型getdata------单行get*|*int、double、float、smallint、uinteger、usmallint、tinyint、utinyint、bigint、ubigint*|  
|  
|
|*get_data_02*|*不同数据类型getdata------单行get*|*char、bit、raw*|  
|  
|
|*get_data_03*|*不同数据类型getdata------单行get*|*date、time、timestamp、number*|  
|  
|
|*get_data_04*|*用SQL_C_CHAR---------------getdata*|*char、clob、blob  (lob类型给多少fetch多少)*|  
|  
|
|*get_data_05*|*get数值为null（单行、多行get data）*|  
|  
|* 是否返回SQL_NULL_DATA*|
|*get_data_06*|*多次调用getdata  是否返回SQL_NO_DATA*|  
|  
|*  *|
|*get_data_08*|*get数据长度大于缓冲区是否截断 *|*char*|  
|  
|
|*get_data_09*|*不按列顺序进行getdata操作*|  
|  
|  
|
|*get_data_10*|*绑定列和未绑定列使用getdata操作*|  
|  
|  
|
|*get_data_11*|*SQLSetPos设置不按行顺序getdata*|  
|  
|  
|
|*get_data_12*|*多次fetch--多次get*|  
|*多次fetch在和客户那边有core出现*|  
|
|  
|  
|  
|  
|  
|
|*get_data_error_01*|*在fetch之前使用getdata*|  
|24000|  
|
|*get_data_error_02*|*StatementHandle给无效值 或 hdbc*|  
|符合预期|返回无效句柄|
|*get_data_error_03*|*Col_or_Param_Num 检索列为 0 或者 -1  *    
|  
|07009|  
|
|*get_data_error_04*|*Col_or_Param_Num *  *大于结果集中的列数*|  
|07009|  
|
|*get_data_error_05*|*TargetType 目标类型不给出 *|  
|HY003|  
|
|*get_data_error_06*|*TargetType 目标类型 无法转换*|受限数据类型属性冲突|  
|  
|
|*get_data_error_07*|*TargetValuePtr为null*|  
|HY009-----符合预期|  
|
|*get_data_error_08*|*BufferLength等于0（不报错*|  
|符合预期|当   *BufferLength*   小于 0 时，  **SQLGetData**   返回 SQLSTATE HY090 (无效的字符串或缓冲区长度) ，但   *BufferLength*   为 0 时则不返回。|
|*get_data_error_09*|*BufferLength < 0*|  
|HY090|  
|
|*get_data_error_10*|*StrLen_or_IndPtr 为null*|不报错|  
|  
|


# 5.  ** 测试用例设计**

  


# 6.   **测试框架设计**

使用cunit框架进行测试

# 7.   **测试环境说明**

**Windows环境，安装Linux下最新崖山数据库**

## Attachments: