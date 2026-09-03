

SR链接：  [https://pingcode.yasdb.com/pjm/items/670736ba6544792659b35e44?](https://pingcode.yasdb.com/pjm/items/670736ba6544792659b35e44?)  #YDBRD-33742 开发任务：支持to_clob函数



# 1 设计简介

本文档以支持to_clob函数概要设计/需求分析文档作为指导，对YashanDB持to_clob函数模块进行设计，明确主要的数据结构和主要处理过程，作为后续编码阶段的输入和编码、测试人员的指导。



# 2 特性概述

支持to_clob函数，仅支持单机和集群行表。

# 3 方案分析（可选）

*无*



## 3.1 业内方案分析（可选）

*无*



## 3.2 外部依赖分析（可选）

*无*



# 4 特性设计

## 4.1 总体方案

## 4.2 功能设计

1. 以调研文档的  **表列表现为准**  。即不论是plsql变量还是sql变量，只有blob类型作为原数据时，允许2-3个参数，且第二个参数实际生效，第三个参数  **语法兼容？**  。其他类型作为原数据都只允许一个参数。
1. 第二个参数用INT64承接，溢出报错。
1. oracle已经实现的字符集ID参数yashan没有，此需求实现上会用CodCharsetId作为oracle字符集ID的替代。具体见下述结构体。（字符集ID只有0-5生效）  【外场使用csid的话要做兼容处理】
    1. ![image.png](https://pingcode.yasdb.com/atlas/files/public/67f3985439823f2ac1f27551/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBSUVBQUFBQUFBQUFFQUFBQUFBREFBQUFBQUFBQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcxMDMsImV4cCI6MTc4MjM3NzkwM30.dp_VUEeQSz9aTXYjZWZrPD5uZhtvZo8gjrChfkKQAok)
1. ![image.png](https://pingcode.yasdb.com/atlas/files/public/67ebaa6839823f2ac1f2738c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBSUVBQUFBQUFBQUFFQUFBQUFBREFBQUFBQUFBQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcxMDMsImV4cCI6MTc4MjM3NzkwM30.dp_VUEeQSz9aTXYjZWZrPD5uZhtvZo8gjrChfkKQAok)
1. 4、当字节流和字符集ID不匹配时，oracle乱码的场景我们可能乱码可能报错。


### 4.2.1 流程设计

### conclude

第一个参数：拦截udt类型。

如果第一个参数是blob，则进行下述校验。  （第一个参数是blob的绑定参数看下实际表现）

1. 第二个参数：如果有，则会校验数值属性已经是否是合法的charsetId(const情况下校验)。
1. 第三个参数：如果有，  需要校验吗？还是直接忽略（再看下外场使用）


如果第一个参数不是blob，且args.count大于等于1，则报错。

### verify

第一个参数reduce varchar类型。第二个参数reduce int类型。第三个参数reduce varchar类型。

调用conclude

结果vrfr加上EXPR_FLAG_LOB。

### exec

第二个参数转INT64（超过报错）

BLOB类型：  （关注性能要求）

1. 依次用MAX_STRING_SIZE 65534  （可能转换出来的结果会超过65534，导致中途报错，但是实际预期是成功）  去读BLOB到临时BUFFER，然后用.nextCharLengthB函数  （取出字符数*目标字符集一个字符最大的字节长度，大于65534也能挂到text上再挂到variant挂clob）  ，扫描当前BUFFER中从左到右是否是有效的输入字符集ID的字节流。


- 是的话往下读，直到读完整个BUFFER，对整个BUFFER调用服务端字符集转换函数codText2DstCharsetText（统一先转到了unicode），将转换结果拼接到目标CLOB上（目标CLOB是服务端字符集）。再读MAX_STRING_SIZE的长度进行循环。
- CodResult codText2DstCharsetText(const CodText* srcText, CodUint16 srcCharset, CodText*   dstText  , CodUint16 dstCharset, CodUint32 maxLen)
- 不是的话，先检查BUFFER剩余字节数。（'中文字符'->  XXX XX  X XXX X  XX）
    - 如果剩 余字节数大于输入字符集单个字符的最大字节数，则报错（说明不是合法的输入字符集的字节流）。
    - 如果剩余字节数小于等于输入字符集单个字符的最大字节数（说明很可能是一个字符的多个字节被截取到了两个BUFFER中），就将当前已经解析的BUFFER内容调用服务端字符集转换函数codText2DstCharsetText，将转换结果拼接到目标CLOB上。然后从当前失败位置开始，再读MAX_STRING_SIZE的长度进行循环。


RAW类型：

varConvert

NCLOB：（一个字符一定是两个字节）

varConvert（目标字符集的一个字符不一定是两个字节）

CLOB类型：

给retValue创建一个临时LOB，拷贝原数据字节过来。

其他类型：

varConvert到varchar，再从varchar到clob。

### 4.2.2 关键数据结构设计

### 4.2.3 外部依赖接口设计（可选）

## 4.3 非功能性设计

*不涉及*



### 4.3.1 性能设计

*不涉及*



### 4.3.2 安全性设计

当前功能、特性属于普通内置函数范围，不涉及权限控制、加密等场景。

# 5 资料设计

  [TO_CLOB | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.5alpha/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions-(yashan-Mode)/TO_CLOB.html)  



# 6 自测用例设计

|测试项目||
|---|---|
|两种语法原数据都覆盖所有类型（注意national和非national）/绑定参数||
|csid：默认/0/和输入字节流匹配/和输入字节流不匹配/不存在的字符集||
|mine_type：语法上兼容（即支持的参数可以是1-3个）||
|一个字符的多字节放到了两个BUFFER上||
|空LOB/空串||




# 7 参考资料（非必选）

*无*



# 8 资料模板

|**填写事项**|**功能1**|**功能2**|**......**|
|---|---|---|---|
|用途/规则/运行结果说明|支持TO_CLOB函数|||
|成功运行前提,权限、参数开关、需要先执行的其他功能等|无|||
|约束限制,支持的部署形态、表形态、长度、类型、大小等|仅支持单机和集群行表。  
第三个参数仅语法兼容|||
|ebnf/命令格式|to_clob = TO_CLOB "(" expr ["," csid] ["," mime_type] ")".|||
|选项/参数说明|**expr**,通用表达式，需要被转换的数据。,- 当expr的值为NULL时，函数返回NULL。,- 当expr的为BLOB/BFILE类型时，函数支持1-3个参数。当expr不是BLOB/BFILE类型时，函数仅支持1个参数。,**csid**,指定BLOB/BFILE数据的字符集ID。如果BLOB/BFILE数据的字符集与数据库当前字符集一致，则可以将csid的值指定为0，或完全省略csid。,<sharedoc fromid=csid>,**mime_type**,该参数仅用于语法兼容，无实际意义。|||
|例外/异常说明|无|||
|其他说明|无|||


