Created by 陈俊杰, last modified on 十月 18, 2024

*详细设计-YDBRD-26621: UTL_FILE高级包PUT/GET_RAW子函数方案设计*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66164b85009f91eb87f36f93](https://pingcode.yasdb.com/ship/ideas/66164b85009f91eb87f36f93)    *?#YASHAN-2830 新增UTL_FILE系统包子函数*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276cccfd997db58adfd9f7](https://pingcode.yasdb.com/pjm/items/66276cccfd997db58adfd9f7)    *?#YDBRD-26621 新增UTL_FILE系统包子函数*

##   [](#1-总述)      [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#1-%E6%80%BB%E8%BF%B0)  

UTL_FILE高级包为PL/SQL提供了一系列操作操作系统文件的能力，如文件打开、文件关闭、文件读写和文件属性等。

yashan数据库已经完成了UTL_FILE高级包大部分能力的支持和兼容，本需求将继续支持UTL_FILE中针对RAW数据读写的GET_RAW和PUT_RAW两个存储过程。

RAW数据是以字节为单位的二进制数据，操作RAW数据时不需要进行字符集转换，能避免数据迁移时字符集不兼容导致不一致的问题。

###   [](#11-需求来源)      [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求来源：产品化需求。

需求场景：ORACLE兼容场景，PL/SQL支持从缓存区对RAW的读写。

需求范围：新增GET_RAW和PUT_RAW，支持单机、分布式和集群。

*关联特性的交付形态是单机，实际测试下分布式和集群都支持UTL_FILE高级包，但不支持create directory*

###   [](#12-调研文档)      [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [调研记录](https://conf.yasdb.com/pages/viewpage.action?pageId=153002709)  

###   [](#13-需求分析)      [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

关联特性：    [UTL_FILE高级包](https://jira.yasdb.com/browse/YDBRD-13358)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|UTL_FILE.GET_RAW|从文件中读取指定长度字节的数据转为RAW类型存储到缓冲区|是|是|
|功能|UTL_FILE.PUT_RAW|将缓冲区中的RAW数据写入文件|是|是|
|兼容性|兼容ORACLE和关联需求|在规格和约束中对齐|是|是|


##   [](#2-接口)      [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#2-%E6%8E%A5%E5%8F%A3)  

**GET_RAW**

```
UTL_FILE.GET_RAW (
    file    IN  UTL_FILE.FILE_TYPE,
    buffer  OUT NOCOPY RAW,
    len     IN  PLS_INTEGER DEFAULT NULL);

参数说明：
file：UTL_FILE.FILE_TYPE文件描述符
buffer：出参，读取的缓存buffer
len：读取长度，默认NULL；若为NULL，读取RAW类型最大长度32000bytes

```

**PUT_RAW**

```
UTL_FILE.PUT_RAW (
    file      IN  UTL_FILE.FILE_TYPE,
    buffer    IN  RAW,
    autoflush IN  BOOLEAN DEFAULT FALSE);

参数说明：
file：UTL_FILE.FILE_TYPE文件描述符
buffer：RAW数据缓冲区
autoflush：布尔值，表明写后是否立即刷到磁盘，默认FALSE

```

##   [](#3-规格与约束)      [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

*此处规格约束基于调研结论和关联特性的既有规格总结而来，具体实现时若有变更需要与测试沟通是否合理*

|规格/约束项|分类|内容|原因|备注|
|---|---|---|---|---|
|换行符|规格|1、GET_RAW遇到行终止符不会停止而是继续读取直到RAW数据最大长度或文件末尾 2、单次put_raw无论是否autoflush都不会追加换行符，fclose时会追加必要的换行符|oracle对外规格||
|其他特殊字符|规格|1、特殊控制类字符（如回车等）均转为对应ascii码的RAW数据处理 2、PUT_RAW时遇到非16进制字符会报错|oracle对外规格||
|max_linesize相关|规格|GET_RAW和PUT_RAW不受max_linesize影响|yashan规格|oracle在某些场景会报错某些则不会，容易让用户困惑|
|读写模式限制|规格|GET_RAW和PUT_RAW要求文件分别以r和a/w打开，否则报错|oracle对外规格||
|RAW数据最大长度|规格|RAW数据作为variant时最大长度为32000|yashan规格|oracle最大32767|
|部分函数不支持二进制打开文件|规格|不支持二进制模式打开的函数：FGETPOS、FSEEK、GET_LINE、PUT_LINE|oracle对外规格|报invalid operation|
|支持二进制打开|规格|ab, wb, rb三种二进制打开模式在本需求完成支持|需求特性支持||
|NOCOPY|约束|NOCOPY关键字用于语法兼容无实际含义|既有规格||
|列执行不支持高级包的内置函数|约束||既有规格||
|文件创建默认权限|规格|UTL_FILE高级包创建的文件对所有者具有读写权限，用户组具有读权限|与yashan创建其他文件的权限规格对齐||
|block size字段仅作兼容|约束|fgetpos时返回的block size字段默认为0，无实际意义|关联需求的既有规格||


##   [](#4-特性)      [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#4-%E7%89%B9%E6%80%A7)  

###   [](#41-get-raw)      [4.1 GET_RAW](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#41-GET_RAW)  

####   [4.1.1 流程设计](#411-流程设计)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d62a1ad9a3311dc90da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4NDksImV4cCI6MTc4MjMxODY0OX0.Qcb9mpv1fwMNPftjMCtsGTbQ9E8OLHmENAsMMzhgzkQ)

###   [](#42-put-raw)      [4.2 PUT_RAW](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#42-PUT_RAW)  

####   [4.2.1 流程设计](#421-流程设计)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d62a1ad9a3311dc90db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4NDksImV4cCI6MTc4MjMxODY0OX0.Qcb9mpv1fwMNPftjMCtsGTbQ9E8OLHmENAsMMzhgzkQ)

###   [4.3 其他兼容](#43-其他兼容)  

####   [4.3.1 文件打开模式](#431-文件打开模式)  

1、linux下二进制模式与文本模式打开无差异

2、windows下二进制模式与文本模式有差异，主要体现在换行符的处理上：如果以文本模式打开文件，系统会将所有的"/r/n"转换成"/n"；当写入文件的时候，系统会将"/n"转换成"/r/n"写入；如果以二进制方式打开，则读/写都不会进行这样的转换

3、不支持二进制模式打开的函数：FGETPOS、FSEEK、GET_LINE、PUT_LINE、NEW_LINE、PUT

4、不支持时报错"file operation failed"

5、支持以不同的模式同时打开同一文件

####   [4.3.2 UTL_FILE支持产品形态](#432-utl-file支持产品形态)  

##   [](#5-testcases自测用例)      [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*开发自测用例仅覆盖正常场景以及与功能规格有关的特殊场景*

|场景|具体说明|预期||备注|
|---|---|---|---|---|
|场景1|创建文件后使用put_raw写入raw数据到文件，使用get_raw读出raw数据并输出|操作成功，结果正确|||
|场景2|创建文件后使用put_raw写入raw数据到文件，使用get_line读出字符串并输出|操作成功，结果正确|||
|场景3|创建文件后使用put_line写入字符串到文件，使用get_raw读出raw数据并输出|操作成功，结果正确|||
|场景4|put_raw或get_raw时raw数据的行长度超过fopen时指定的max_linesize|报错|||
|场景5|多次put_raw写不带换行符的raw数据|中间不追加换行符，fclose时追加必要的换行符|||
|场景6|put_raw时携带特殊控制类字符|操作成功|||
|场景7|put_raw时携带非16进制字符|报错|||


##   [](#6资料设计章节)      [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1、高级包新增子函数说明和示例

##   [](#7未来规划)      [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

##   [8.工作量评估](#8工作量评估)  

1、调研+设计：3天

2、编码：3天

3、自测：2天

预计转测：2024/5/22

## Attachments:

## Comments:

|  [](null)  ,1、关联特性实现UTL_FILE高级包时未支持ab, wb, rb 三种打开模式，在此需求交付时予以支持,2、关联特性交付UTL_FILE高级包时未验证分布式和集群的兼容性，在此需求交付时完成兼容验证,3、分布式下以匿名块执行,4、put_raw往文件里写不符合字符集的raw串，后用get_line读出的场景需要自测覆盖，并与oracle做对比,5、支持同时以不同的读写模式打开同一个utl_file.file_type ，oracle也支持,Posted by chenjunjie at 五月 16, 2024 14:43|
|---|
