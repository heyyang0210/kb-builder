*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6757fc2b64bf51159814e3ed?](https://pingcode.yasdb.com/pjm/items/6757fc2b64bf51159814e3ed?)  

#YDBRD-36367 odbc支持SQLExecDirectW、SQLMoreResults和guid data type功能

##   [1. 总述](#1-总述)  

外场需求，在C调用ODBC通过绑定guid类型SQL_C_GUID的方式查询数据库guid。目前ODBC驱动不支持SQL_C_GUID类型绑定，此SR主要实现此功能。

###   [1.1 需求来源](#11-需求来源)  

西部石油

###   [1.2 调研文档](#12-调研文档)  

暂无，按照外场场景实现对应功能。

###   [1.3 需求分析](#13-需求分析)  

1. ODBC绑定SQL_C_GUID类型参数，转换成字符串类型，然后调用绑定参数
1. guid SQLGUID转换字符串类型的实现
1. 绑定字符串参数对应的内存申请和释放


|属性   |场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能    |支持SQL_C_GUID类型的参数绑定|将SQL_C_GUID类型参数转换成字符串绑定|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

不涉及新增语法等内容，一些规格与主干版本一致。

##   [3. 规格与约束](#3-规格与约束)  

只支持SQL_C_GUID的参数绑定，不支持出参。

##   [4. 特性](#4-特性)  

###   [4.1 绑定参数部分](#41-特性设计)  

1. 在SQL_C_GUID类型转换为C驱动类型时转换为YAC_SQLT_CHAR2
1. 在SQL_C_GUID类型绑定前先需要申请临时的转换空间
1. 拷贝参数时调用类型转换将guid转换为字符串


###   [4.2 类型转换部分](#42-特性功能点2)  

GUID的结构

| unsigned long  Data1||||||||
|---|---|---|---|---|---|---|---|
|unsigned short Data2||||unsigned short Data3||||
|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|unsigned char  Data4|


1. 将GUID转换成十六进制（小写）：nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn  例如b2db1bc9-de31-1305-e044-0003ba9a76e3
1. 结尾不能带\0的结束符
1. 字符大小36，buffer长度37。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. guid类型转换正常
1. 绑定参数能够完成正常的插入
1. fetch数据能够按照字符串的形式正常展示


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。