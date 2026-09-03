Created by 邓秋怡, last modified on 八月 15, 2024

  


  


详细设计-YDBRD-26306 : 支持FIND_IN_SET等函数方案设计

IR链接：    [YASHAN-290](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b072?#YASHAN-290)  

SR链接：    [YDBRD-26306](https://pingcode.yasdb.com/pjm/items/66193065fd997db58ad8a82e?#YDBRD-26306)  

##   [1. 总述](#1-总述)  

支持FIND_IN_SET等字符串函数的使用，与Mysql 5.7对齐

###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档见    [FIND_IN_SET等字符串函数调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=159429574)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|CONVERT|CONVERT函数主要作用将数据转换为指定字符集的数据或者指定类型。|是|是||
|JSON_EXTRACT|从JSON路径中选取与指定路径参数匹配的部分返回数据，如果这些参数可能返回多个值，则匹配值会自动封装为一个数组返回。|是|是||
|LOAD_FILE|读取文件并以字符串形式返回文件内容。|是|是|是|
|ROW_COUNT|返回上一条执行的语句的统计信息。|是|是||
|FIND_IN_SET|返回字符串在一个逗号分隔的字符串列表中的索引|是|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

与Mysql差异：

1. convert函数内有涉及字符集相关的转换，mysql服务端字符数据看起来像是带字符集类型的，yashan服务端字符数据在建库时指定，即convert函数只能在当前层做字符集转换，转换后的结果若再作为其他sql语句的入参，将不保证字符集的正确性。（待补充转换场景）
1. find_in_set函数第二个参数暂不支持set类型，一二个参数都不支持raw类型。
1. row_count函数：ALTER TABLE【mysql目前调研到只有修改类型才会非0，yashan返回0】、UPDATE【mysql受到参数CLIENT_FOUND_ROWS的影响，YASHAN返回WHERE子句匹配的记录数】。
1. load_file服务端会存在lob最大大小4g的限制,超出则报错。若权限不够，yashan会报相应权限错误，而不是直接返回null。
1. convert函数如果原数据超出目标数据的精度范围，则截断输出而非报错。mysql是截断输出后有warning。
1. json_extract('[1,2,3]','$[*]')


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

###   [4.1.1 CONVERT](#411-convert)  

- CONVERT(expr USING transcoding_name)   -> expr CONVERT_CHARSET transcoding_name
- CONVERT(expr,type)                     -> expr CONVERT_TYPE type
- CONVERT(expr,CHAR[(N)] [charset_info]) -> expr CONVERT_TYPE type charset_info    
  对输入参数进行expr重新连接。类型转换类似cast逻辑。字符集转换调用codTextConvert，给出原charset和目标charset。


###   [4.1.2 JSON_EXTRACT(json_doc, path[, path] ...)](#412-json-extractjson-doc-path-path-)  

第一个参数若为非json类型，走类似json()内置函数的逻辑转换为json类型。    
  然后对每一个path去json_doc查找结果，逻辑类似于json_query()内置函数。    
  然后对每一个path的查找结果进行拼接，最终返回json类型。

###   [4.1.3 LOAD_FILE(path)](#413-load-filepath)  

权限部分使用系统参数secure_file_priv以及权限FILE限制用户的读取，具体参照文档：    [YDBRD-29314: LOAD DATA权限](https://conf.yasdb.com/pages/viewpage.action?pageId=156122798)      
  权限校验结束后通过系统函数openFile,readFile（字节流读取）进行读取，将内容存入系统参数max_allowed_packet大小的buffer中返回。（待补充mysql字符集转换场景）

###   [4.1.4 ROW_COUNT()](#414-row-count)  

mysql会话下执行sql语句时修改stmt->attr.ackExec.affectedRows的变更逻辑，（但是在mysql会话下会影响其他使用这个变量的语句，如sql%row_count）。    
  待讨论：CLIENT_FOUND_ROWS是否需要（不支持），指定此参数后，update到相同值，affectedRows也会++，不指定则是实际更改的行数（INSERT ... ON DUPLICATE KEY UPDATE语句同理）。merge into用原来的逻辑。

###   [4.1.5 FIND_IN_SET()](#415-find-in-set)  

mysql第二个参数除了支持string类型还支持set类型。但由于set类型还未开发完成，所以本次迭代也只能先只支持string类型。其他部分和已有find_in_set函数类似，还需关注空串的适配（待补充差异点，bool类型待调研）。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- CONVERT：字符集覆盖，type覆盖，空串转换覆盖。
- JSON_EXTRACT：第一个参数类型或格式非法覆盖，最大长度32k覆盖（mysql上界待调研），path结果数据覆盖，最终结果空、一个元素、多个元素覆盖。
- LOAD_FILE：路径名不完整/完整。 FILE 权限有/无。max_allowed_packet长度限制覆盖。secure_file_priv空/指定路径覆盖。
- ROW_COUNT：调研文档中表格所列情况覆盖。
- FIND_IN_SET：主要关注已有实现和mysql的差异点，如空串、（待补充）。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


  


## Attachments:

[image2024-4-25_10-35-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZDk4OTcwYzJhZjRmNTIxYmQ5IiwicmVmX2lkIjoiNjczOTZlZDk1OTNmOTljOWZmMjM4YTI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDMwLCJleHAiOjE3ODI1MzA4MzB9.evmFNF0PO8xwco-o3DaQDasJ_qu34nxt0zgPGPXlpuo)

 (image/png)    


[image2024-4-25_11-37-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZDk4OTcwYzJhZjRmNTIxYmRiIiwicmVmX2lkIjoiNjczOTZlZDk1OTNmOTljOWZmMjM4YTI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NDMwLCJleHAiOjE3ODI1MzA4MzB9.OfREBa7w_CISz0tm3fZ3l3qc_3P1hTkxXfys8nR8OG8)

 (image/png)    
