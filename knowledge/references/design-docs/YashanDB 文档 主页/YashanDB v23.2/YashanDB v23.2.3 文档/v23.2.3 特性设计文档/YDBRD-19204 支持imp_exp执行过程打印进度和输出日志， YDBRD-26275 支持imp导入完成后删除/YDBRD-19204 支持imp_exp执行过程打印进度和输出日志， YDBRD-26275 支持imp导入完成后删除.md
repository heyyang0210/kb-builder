Created by 叶子, last modified on 五月 28, 2024

  [https://pingcode.yasdb.com/pjm/items/66115684579a3edb84d68cbe](https://pingcode.yasdb.com/pjm/items/66115684579a3edb84d68cbe)    ?    
  #YDBRD-19168 【imp/exp】支持执行过程中打印进度和输出日志

  [https://pingcode.yasdb.com/pjm/items/6618f0cefd997db58ad84b89](https://pingcode.yasdb.com/pjm/items/6618f0cefd997db58ad84b89)    ?    
  #YDBRD-26275 【imp】支持选项在导入完成后删除原始数据文件

  


##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|运行过程打印进度|主线程|是|是|
||日志补充|运行过程增加补充打印进度信息日志|否|是|
||添加参数控制|  
|否|是|
||运行成功删除文件|  
|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

  [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 命令行参数

exp参数变动：

|参数名称|接口变现|
|---|---|
|PROGRESS|控制元数据导出过程是否显示导出进度信息。默认值为NULL，取值范围为[NULL,DETAIL]。|
|LOG_PATH|指定  元数据导出过程  写入日志文件的目录, 缺省时会在当前执行路径下创建日志文件，支持相对路径|
|LOG_LEVEL|控制  元数据导出过程  日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|
|--detail|控制CSV导出过程是否显示导出进度。缺省时表示不显示导出进度。|


imp参数变动：

|参数名称|接口表现|
|:---|:---|
|FILE_DELETE|控制导入成功后是否删除原始数据文件，默认值为N, 取值范围是[Y, N].|
|PROGRESS|控制导入过程是否打印导入进度。默认值为NULL，取值范围为[NULL,DETAIL]。|
|LOG_PATH|指定写入日志文件的目录, 缺省时会在当前执行路径下创建日志文件，支持相对路径|
|LOG_LEVEL|控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

##### 4.1.1 exp支持显示进度

命令行指令变动：

```
1.metadata export:

To specify parameters, you use keywords:
     Format:  EXP KEYWORD=value or KEYWORD=value1,value2,...,valueN
     (there must be no spaces between value1 and value2)
     Example: EXP username/password TABLES=T1,T2

username/password must be the first on the command line.

Keyword    Description (Default)      Keyword      Description (Default)
------------------------------------------------------------------------
FULL       export entire file (N)     FILE         output files
OWNER      list of owner usernames    TABLES       list of table names
ROWS       export data rows (Y)
//新增参数
PROGRESS    show import progress

2.CSV data export:
#Config File 
   exp --csv --config-file {file path}

#Command Line 
   Note: Parameters marked with * are required.

   exp --csv {Common Options} {Export Options} {CSV Options}
         -h  --help                            Display help message and exit.
         -v                                    Display version and exit.
   #Common Options:
       * -f, --format &lt;format&gt;                 Format of output files, possible values:csv.
       * -u, --user &lt;user&gt;                     User name to log in server.
       * -p, --password &lt;password&gt;             Password to log in server.
         -L, --logfile &lt;path&gt;                  Specify which directory to write the log file.
         -F, --file                            Specify which directory to write the export file.
         --lob                                 Set lob export method, possible values: lls, csv. default: lls.
         --inline-blob-format                  Set blob export format when the value of --lob is csv, possible values: binary, string. default: binary.
         --loglevel &lt;level&gt;                    Set log level, possible values: off, error, warn, info, debug, trace. default: info.
         --server-host &lt;host&gt;                  Host(hostname:port) of server, default: 127.0.0.1:1688.
         --use-threads &lt;num&gt;                   Number of working threads, default: 1.
         //新增参数
         --progress                            whether show progress when export.


```

使用示例

```
exp&nbsp;--csv -f csv -u sys-p 123456 --progress&nbsp;

```

  


元数据导出执行情况显示样例及说明： 

![](https://pingcode.yasdb.com/atlas/files/public/67396d498970c2af4f5211d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUJBQUFBQUFBQ0FBQVFBQUFBZ0FFQUFBQUFBQUFBQUlDQUFBSUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUVBQUFBQUFCQWdBZ0FBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUVDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwNzEsImV4cCI6MTc4MjMxNzg3MX0.MlwQ6haVorrs5vMRhGq9W35GajkyOhDoEj1YJWveHbY)

1. 根据使用的视图不同和导出范围不同，在开始前给予提示

![](https://pingcode.yasdb.com/atlas/files/public/67396d498970c2af4f5211d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUJBQUFBQUFBQ0FBQVFBQUFBZ0FFQUFBQUFBQUFBQUlDQUFBSUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUVBQUFBQUFCQWdBZ0FBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUVDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwNzEsImV4cCI6MTc4MjMxNzg3MX0.MlwQ6haVorrs5vMRhGq9W35GajkyOhDoEj1YJWveHbY)

2. 执行情况打印包含：

- tablespace
- profile
- user
- privilege
- dblink
- sequence
- synonyms
- type
- table
- ac
- index
- constraint
- primary key
- foreign key
- audit policy
- outline
- sql map


  




##### 4.1.2 imp支持显示进度 / imp支持导入完成删除文件

命令行指令变动：

```
YashanDB Import Enterprise Edition Release 23.2.1.100 x86_64 b3ff5dc

To specify parameters, you use keywords:
     Format:  IMP KEYWORD=value or KEYWORD=value1,value2,...,valueN
     (there must be no spaces between value1 and value2)
     Example: IMP username/password TABLES=T1,T2

username/password must be the first on the command line.

Keyword    Description (Default)      Keyword      Description (Default)
------------------------------------------------------------------------
FULL       import entire file (N)     FILE         input files
FROMUSER   list of owner usernames    TABLES       list of table names
IGNORE     ignore create errors (N)   TOUSER       list of usernames
ROWS       import data rows (Y)       DATA_ONLY    import only data (N)
TRUNCATE   delete existing rows and then import (N)
//新增参数
PROGRESS    show import progress
FILE_DELETE delete files after import
LOG_PATH    the path of run.log
LOG_LEVEL   the log level of run.log

```

  


使用示例:

```
imp sales0/sales0 file=export.owner.export progress=detail file_delete=true log_path=./ log_level=info

```

  


进度显示样例及说明： 

![](https://pingcode.yasdb.com/atlas/files/public/67396d49a1ad9a3311dc9046/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUJBQUFBQUFBQ0FBQVFBQUFBZ0FFQUFBQUFBQUFBQUlDQUFBSUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUVBQUFBQUFCQWdBZ0FBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUVDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwNzEsImV4cCI6MTc4MjMxNzg3MX0.MlwQ6haVorrs5vMRhGq9W35GajkyOhDoEj1YJWveHbY)

1. 根据使用的视图不同和导出范围不同，在开始前给予提示

![](https://pingcode.yasdb.com/atlas/files/public/67396d4aa1ad9a3311dc9047/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUJBQUFBQUFBQ0FBQVFBQUFBZ0FFQUFBQUFBQUFBQUlDQUFBSUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUVBQUFBQUFCQWdBZ0FBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUVDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwNzEsImV4cCI6MTc4MjMxNzg3MX0.MlwQ6haVorrs5vMRhGq9W35GajkyOhDoEj1YJWveHbY)

2. 执行情况打印包含：

- tablespace
- table
- index
- constraint
- object
- trigger
- store object
- sql
- user
- role
- profile
- privilege
- table privilege
- object privilege
- audit policy
- outline
- sql map
- type dep
- ac
- dblink


3.遇到owner触发switch时，在switch操作成功后会打印

![](https://pingcode.yasdb.com/atlas/files/public/67396d4aa1ad9a3311dc9048/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQWdDQUFBQUFBQUFBQUJBQUFBQUFBQ0FBQVFBQUFBZ0FFQUFBQUFBQUFBQUlDQUFBSUFBQUFBQUFBQUFBQUFBQ2dBQUFBQUFBQUFBQUVBQUFBQUFCQWdBZ0FBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUVDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwNzEsImV4cCI6MTc4MjMxNzg3MX0.MlwQ6haVorrs5vMRhGq9W35GajkyOhDoEj1YJWveHbY)



###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

进度打印相关

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

此MR涉及新增配置参数，完成时需更新文档中的参数说明相应内容

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[yasldr.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDhhMWFkOWEzMzExZGM5MDNiIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.oyMuot0JGGZYiI-CL7_5SvwOcB0lN5wfCJchN1GzKJQ)

 (image/png)    


[image2024-3-11_16-4-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDg4OTcwYzJhZjRmNTIxMWNiIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.s9rRNRvlJ3RYqox3Zrw9asfMhz12Mzssk1blesV40dk)

 (image/png)    


[log.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDg4OTcwYzJhZjRmNTIxMWNjIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.L1mGZXoobuGBaZNY7XcQPp7iqLKC1WHZLlaIq5kyMTM)

 (image/png)    


[image2024-5-23_14-58-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDhhMWFkOWEzMzExZGM5MDNjIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.bjje1xc0XlDyIygFJB8CHxxaDWQgzHdjnpBJudG2ABQ)

 (image/png)    


[yasldr.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDhhMWFkOWEzMzExZGM5MDNkIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.QsMSMlJaYUQEDgr4WL12ey8MXPA7aZlwQcgMCzzgM-Y)

 (image/png)    


[expprogress.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDlhMWFkOWEzMzExZGM5MDNlIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.R3rTnhfkQWzyU2yopBZRg5_DWBsEG6HKTon4bPdcp3g)

 (image/png)    


[impflow.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWNkIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.bGAyxPYOVG2NIkPlDjAT9oiGDjCKGE9L4_lEasFudK8)

 (image/png)    


[impflow.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWNlIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.dbIIqHJN4I_JyZjfAPzTj6JtF36pmJdzRvcyOTNw9EA)

 (image/png)    


[impflow.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDlhMWFkOWEzMzExZGM5MDNmIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.8OPCjrVM012t7zZyVioamc3SwMAR5H6hVBfWZiOmcEw)

 (image/png)    


[image2024-5-28_10-43-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWQwIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.u1k2RaRl1CD_TJpB65ke-zqtNUQzsuNqiF6pebOckaE)

 (image/png)    


[image2024-5-28_14-15-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWQxIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.8N9jrSmvYZU5thlDAoZYnRu-g1oqn7yQemQehirjzIA)

 (image/png)    


[image2024-5-28_14-18-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWQyIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.TQRcF7qRQzECg4KJP2ip5UyZ0ox5kOwBBh5c7yUimhY)

 (image/png)    


[image2024-5-28_14-35-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDlhMWFkOWEzMzExZGM5MDQ0IiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.aupD4PFP2D4kp343QZP_0WV6_3ZtAe-E2dJ_SYymzJQ)

 (image/png)    


[image2024-5-28_14-36-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDlhMWFkOWEzMzExZGM5MDQ1IiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.6-s93_t7gpZo1ciylG6MG3pj6HU_DrLPIGvKiyJObl0)

 (image/png)    


[image2024-5-28_14-57-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDk4OTcwYzJhZjRmNTIxMWQzIiwicmVmX2lkIjoiNjczOTZkNDg3MjgyMDZlZmI5MmYxZDFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDcxLCJleHAiOjE3ODIzOTM0NzF9.Za_5Cye-urK-kRnCImSi05RcV_8lHeTm4WAnj0Jy4o8)

 (image/png)    


## Comments:

|  [](null)  ,exp是否需要支持元数据导出进度    
  exp进度计算方式确认,进度不必局限进度条，获取执行情况打印或记录到日志中,  
,导入包含告警信息时是否需要删除文件,Posted by yezi at 五月 27, 2024 11:16|
|---|
|  [](null)  ,exp的progress控制元数据和数据的进度显示,imp通过参数控制增加打屏执行情况,参考oracle的导入导出进度显示,  
  导入包含告警信息时也需要删除文件,Posted by yezi at 五月 27, 2024 11:32|
