Created by 陈钦卿, last modified on 四月 18, 2024

# 1. 概述

SR

jira：    [YDBRD-22244](https://jira.yasdb.com/browse/YDBRD-22244?src=confmacro)    -  【yasldr】支持执行过程进度打印和输出日志  待启动

pingcode：    [https://pingcode.yasdb.com/pjm/items/6611568a579a3edb84d68cd7](https://pingcode.yasdb.com/pjm/items/6611568a579a3edb84d68cd7)    ?#YDBRD-19170 【yasldr】支持执行过程进度打印和输出日志

开发设计：

  [YDBRD-22244 Yasldr支持执行过程进度打印和输出日志 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147751455)  

# 2. 需求分析

## 2.1 功能点分析

yasldr的LOAD OPTIONS新增参数  PROGRESS：导入执行过程是否显示导入进度，默认值为NULL，取值范围为[NULL,DETAIL]。

- 导入过程中打印进度条（已读取csv和csv  总大小  的百分比）
- 显示导入成功行数、  导入失败容错的行数（  包括未命中分区、类型转换失败、违反约束  ）、空行数 ---- 三者无包含关系


交付形态：单机

示例：

![](https://pingcode.yasdb.com/atlas/files/public/67396d9da1ad9a3311dc9295/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0)

## 2.2 应用场景

- 大数据量导入时可以直观看到导入进度，知道导入情况


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|输入条件一|输入条件二|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|progress参数校验    
    
|拼写|大写、小写、大小写混合|拼写错误|  
|
||取值|null、detail    
  大写、小写、大小写混合|无关字符串：数字、字母、表情、中文等    
  null、detail拼写错误|  
|
||格式|progress=null,progress=detail|progress==detail,’progress‘=’detail‘  —— 合法|  
|
||位置|LOAD     STATEMENT之前/之后|  
|  
|
|功能校验|导入成功|import：x  rejected：0  discard：0|  
|综合考虑容错相关点：,违反约束、数据类型转换失败、未命中分区、包围符不完整、换行符不可作为数据,  
,数据是否会翻转？uint64,空文件——不生成容错日志，不显示进度条,导入0条。会显示进度条，100%,分区表，关系不大|
|||import：x  rejected：y  discard：0|  
||
|||import：x  rejected：0  discard：z|  
||
|||import：x  rejected：y  discard：z|  
||
||导入失败|超过errors上限导入终止|  
|表现同bad文件|
|||超过discards上限导入终止|  
|  
|
|||数据库配置参数/机器配置参数内存不足|  
|正常打印进度条，报错退出即停止，import，rejected，discard三值不稳定|
|||表空间不足|  
|  
|
|||nologging下出现表损坏|  
|  
|
||日志打印|日志打印内容：,1. 解析完指令后，打印一次该次导入的配置日志
1. 启动reader和sender线程时，打印当前进度日志
1. reader从csv中读取数据中，每获取一次数据打印一次日志
1. reader和sender结束时打印一次日志
1. 若要打印报告，则报告输出完成时打印一次日志
1. 导入命令运行结束，打印一次日志
1. 失败场景补充打印失败日志
|1、  LOG_PATH,指定写入日志文件的目录, 缺省时会在当前执行路径下创建日志文件，支持相对路径,2、LOG_LEVEL,控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|yasldr.log,打印路径——   对齐exp,Oracle打印在控制台,  
,**大概观测日志内容是否合理即可**,文件路径，表名，列名包含中文——后续字符集关注|
|与其他功能结合|lsc表去重|import和rejected如何计算？|去重部分计入import|与服务端导入功能关系不大|
||  
|多sender死锁 —— 进度条？|```
CREATE TABLE supplier (
  S_SUPPKEY         INTEGER         NOT NULL    unique,
  S_NAME            CHAR(25)        NOT NULL,
  S_ADDRESS         VARCHAR(40)     NOT NULL,
  S_NATIONKEY       INTEGER         NOT NULL    ENCODING RLE,
  S_PHONE           CHAR(15)        NOT NULL,
  S_ACCTBAL         DECIMAL(15,2)   NOT NULL,
  S_COMMENT         VARCHAR(101)    NOT NULL
) ORGANIZATION LSC 
ORDER BY (S_SUPPKEY) 
PARTITION BY HASH(S_SUPPKEY) PARTITIONS 16;

yasldr regress/regress@192.168.3.127:1688 progress=detail senders=2 control_text="'load data OPTIONS(DEGREE_OF_PARALLELISM=32,enable_bulk=true,enable_dedup=true,errors=1000000) infile '/data/csv/supplier.csv' fields terminated by '|' infile '/data/csv/supplier01.csv' fields terminated by '|' into table supplier(S_SUPPKEY,S_NAME,S_ADDRESS,S_NATIONKEY,S_PHONE,S_ACCTBAL,S_COMMENT)'" batch_size=2048 csv_chunk_size=256
```|![](https://pingcode.yasdb.com/atlas/files/public/67396d9d8970c2af4f521422/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0)|
||lobfile/lls|  
|  
|  
|
||大数据量|csv大于128M|  
|  
|
||多文件|  
|  
|  
|
||文件拆分|  
|表现同导入|  
|
||basic模式|  
|不影响|  
|
||reader数量|  
|不影响|  
|
|可靠性|导入过程中ctrl+c|时机：导入开始，导入中，导入将结束,大数据量|![](https://pingcode.yasdb.com/atlas/files/public/67396d9da1ad9a3311dc9296/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0),![](https://pingcode.yasdb.com/atlas/files/public/67396d9d8970c2af4f521423/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0)|暂且手动执行，考虑自动化|
|  
|导入过程中kill数据库进程|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396d9d8970c2af4f521424/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0),![](https://pingcode.yasdb.com/atlas/files/public/67396d9da1ad9a3311dc9298/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0)|进度条和日志不会继续变化,  
,有时进度条会打印一大串，不好看。|
|  
|导入过程中kill yasldr进程|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396d9d8970c2af4f521426/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBRUFBQUFZQUFFQWdBQUFBZ0FBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBd0FBSUFqSkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFFQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQVFnQUFBQUFBQUFBQUFDQUFBQ0FDQUFBQUFBQkFDQUFBRUFBQUFBQVFBQUFBZ0FBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAxOTEsImV4cCI6MTc4MjMyMDk5MX0.xjsv_XCSVAoFKWPQ7yGv_zE7r1rwYd31NnGu1UD05m0)|  
|
|  
|某个yasldr线程挂掉|整个进程就停止|  
|  
|
|分布式|yasboot透传progress|  
|  
|进度条打印到yasboot生成的日志中|
|  
|其余表现覆盖一下|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|打开progress开关后性能是否会有影响？|理论上影响不大|
|可维护性|  
|  
|


  


# 4. 测试用例

文本用例：

[yasldr过程打印文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWM4OTcwYzJhZjRmNTIxNDFjIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDdkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTkxLCJleHAiOjE3ODIzOTY1OTF9.C9QsH8peOsuBYY8H5EEsiCQD7rydp5THrPCrujpa-cM)

自动化用例只能看护到最终进度条样式

# 5. 测试框架设计

- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWM4OTcwYzJhZjRmNTIxNDFkIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDdkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTkxLCJleHAiOjE3ODIzOTY1OTF9.bJS2uPqoBSBSXSQDm_QSEoQse0KKmxHryTTkMmPFHY0)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWM4OTcwYzJhZjRmNTIxNDFkIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDdkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTkxLCJleHAiOjE3ODIzOTY1OTF9.bJS2uPqoBSBSXSQDm_QSEoQse0KKmxHryTTkMmPFHY0)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWNhMWFkOWEzMzExZGM5MjhmIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDdkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTkxLCJleHAiOjE3ODIzOTY1OTF9.7aYZxeoNKanUJXCE08ybKFqViOmFP7BUoYvVxvu2twY)

 (application/msword)    


[yasldr过程打印文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWM4OTcwYzJhZjRmNTIxNDFjIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDdkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTkxLCJleHAiOjE3ODIzOTY1OTF9.C9QsH8peOsuBYY8H5EEsiCQD7rydp5THrPCrujpa-cM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,YDBRD-22244 yasldr支持执行过程进度打印和输出日志 测试设计评审纪要    
  与会人：陈钦卿、范瑜、贺国峰、冯皓博、叶子    
  评审时间：2024.04.09 11:00:00    
  会议纪要：    
  1、日志名yasldr.log，路径同exp（--logfile参数），默认打印在前端，支持相对路径    
  2、导入失败时，进度条及导入行数停止变化，数值随机    
  3、分布式稍作验证,Posted by chenqinqing at 四月 09, 2024 15:09|
|---|
