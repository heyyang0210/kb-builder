Created by 叶子, last modified on 四月 30, 2024

*详细设计-YDBRD-22244 Yasldr支持执行过程进度打印和输出日志*

*IR链接：*    [YDBRD-20793](https://jira.yasdb.com/browse/YDBRD-20793?src=confmacro)    *-*  *yasldr支持过程与结果展示优化*  *待RMT评审*

*SR链接：*    [YDBRD-22244](https://jira.yasdb.com/browse/YDBRD-22244?src=confmacro)    *-*  *【yasldr】支持执行过程进度打印和输出日志*  *待启动*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|运行过程打印进度|主线程|是|是|
||日志补充|运行过程增加补充打印进度信息日志|否|是|
||添加参数控制|  
|  
|  
|
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


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 命令行参数

|参数名称|接口表现|
|:---|:---|
|PROGRESS|控制导出过程是否打印导入进度及统计信息。默认值为NULL，取值范围为[NULL,DETAIL]。|
|LOG_PATH|指定写入日志文件的目录, 缺省时会在当前执行路径下创建日志文件，支持相对路径（不可为../相对路径）|
|LOG_LEVEL|控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

命令行指令变动：

原始导入指令格式：

```
YASLDR USERNAME/PASSWORD@IP:PORT {LOAD OPTIONS} {LOAD STATEMENT}

```

  ``    其中LOAD OPTIONS部分新增配置参数PROGRESS，LOG_PATH,  LOG_LEVEL， 参数说明如下：

- PROGRESS：导入执行过程是否显示导入进度，  默认值为NULL，取值范围为[NULL,DETAIL]  。当progress为  NULL  时，表示不打印进度， 当progress为  DETAIL  时，表示打印进度条，当前进度百分比以及部分统计信息。
- LOG_PATH：  指定写入日志文件的目录, 缺省时会在当前执行路径下创建日志文件，支持相对路径（不可为../相对路径）。
- LOG_LEVEL：控制日志的日志级别，默认值为INFO，取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]


使用示例

yasldr     [sales/sales@127.0.0.1](mailto:sales/sales@127.0.0.1)    :1688 batch_size=4032   **progress=detail**  **log_path=./**  **log_level=info**   control_text="'LOAD DATA INFILE '/home/yasdb/area.csv' FIELDS TERMINATED BY '|' optionally enclosed by '"' INTO TABLE area (area_no,area_name,dhq) '"

  


进度显示说明：

  1. 这里的进度条指的是yasldr工具的运行进度，主要有两部分组成：

1. yasldr读取csv文件数据以及数据处理的进度
1. yasldr与数据库交互插入处理好的数据的进度


  2. 进度条会以，进度1和进度2的加权平均数表示，比例为8：2 。 设计的原因是：在之前的使用和测试过程中发现reader的耗时是远高于sender的，而且在大部分场景下，reader的进度近似等于yasldr工具的进度，但有考虑到上面问题单这种sender比reader慢的场景确实存在，所以再尽量不影响大部分场景下的体验时，下调reader的占比到80%。

  3. 进度后面的数字分别表示， 插入成功的数据条数（IMPORT）, 插入失败的数据条数（REJECTED）, 空行数（DISCARD） 

![](https://pingcode.yasdb.com/atlas/files/public/67396dbc8970c2af4f5214e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQWhVQkFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQkFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEyMTMsImV4cCI6MTc4MjMyMjAxM30.-wplup_8ECyYN6HQd6BYiYIRvCuq-YMIBLZNExWCyhA)

  


代码相关：

```
//结构体变动
typedef struct StLdrCsvCtx {
    LdrSliceCtx* sliceCtx;
    CodChar*     buffer;
    CodUint32    completeSize;        //新增变量，表示已完成读取的CSV的数据大小
    CsvReader*   csvReader;
    CsvCursor*   csvCursor;
} LdrCsvCtx;
```

  


流程变动示意

![](https://pingcode.yasdb.com/atlas/files/public/67396dbc8970c2af4f5214ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQWhVQkFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQkFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEyMTMsImV4cCI6MTc4MjMyMjAxM30.-wplup_8ECyYN6HQd6BYiYIRvCuq-YMIBLZNExWCyhA)

进度刷新说明，

1. 以单个reader为例，每次从csv文件中读取一批数据时，更新一次当前reader所持有的ldrCsvCtx的completeSize。
1. 主线程定时收集所有reader的ldrCsvCtx的completeSize, 以及所有sender的rowCount中的统计信息。
1. 根据所有的数据获取完成大小与导入文件总大小算出比值，并刷新当前进度以及统计信息。
1. 等待reader和sender线程全部结束退出后之后，再将进度刷新至100%。


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

日志打印功能实现：

通过引入infra中的日志组件实现日志打印线程功能，实现一个初始化日志函数

```
CodResult ldrInitLogger(YasLdrCtx* ldrCtx);
```

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396dbca1ad9a3311dc935d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQWhVQkFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQkFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEyMTMsImV4cCI6MTc4MjMyMjAxM30.-wplup_8ECyYN6HQd6BYiYIRvCuq-YMIBLZNExWCyhA)

  


日志打印内容：

1. 解析完指令后，打印一次该次导入的配置日志
1. 启动reader和sender线程时，打印当前进度日志
1. reader从csv中读取数据中，每获取一次数据打印一次日志
1. reader和sender结束时打印一次日志
1. 若要打印报告，则报告输出完成时打印一次日志
1. 导入命令运行结束，打印一次日志
1. 失败场景补充打印失败日志


###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

进度打印相关

|序号|操作|预期|
|---|---|---|
|  
|  
|  
|
|1|1. 准备一张表table1和数据文件data1.csv(100行数据，10行违反约束，1行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=detail**   control_text="'LOAD DATA INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|最终进度打印显示为,[##################################################] 100% IMPORT: 100 REJECTED: 10 DISCARD: 1,  
,  
|
|2|1. 准备一张表table1和数据文件data1.csv(100行数据，0行违反约束，0行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=detail**   control_text="'LOAD DATA INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|最终进度打印显示为,[##################################################] 100% IMPORT: 100 REJECTED: 0 DISCARD: 0|
|3|1. 准备一张表table1和数据文件data1.csv(100行数据，100行违反约束，0行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=detail**   control_text="'LOAD DATA OPTIONS(ERRORS=200) INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|最终进度打印显示为,[##################################################] 100% IMPORT: 100 REJECTED: 100 DISCARD: 0|
|4|1. 准备一张表table1和数据文件data1.csv(10行数据，0行违反约束，10行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=detail**   control_text="'LOAD DATA INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|最终进度打印显示为,[##################################################] 100% IMPORT: 10 REJECTED: 0 DISCARD: 10|
|5|1. 准备一张表table1和数据文件data1.csv(100行数据，0行违反约束，0行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=NULL**   control_text="'LOAD DATA INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|不打印进度|
|  
|  
|  
|
|6|1. 准备一张表table1和数据文件data1.csv(100行数据，100行违反约束，0行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=detail**   control_text="'LOAD DATA OPTIONS(  **ERRORS=50**  ) INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|最终进度打印显示为,[#########################-------------------------] 50% IMPORT: 50 REJECTED: 50 DISCARD: 0|
|7|1. 准备一张表table1和数据文件data1.csv(100行数据，100行违反约束，0行空行)
1. 运行 yasldr sales/sales@127.0.0.1:1688 batch_size=4032   **progress=other**   control_text="'LOAD DATA OPTIONS(ERRORS=50) INFILE '/home/yasdb/data1.csv' FIELDS TERMINATED BY ',' optionally enclosed by '\"' INTO TABLE table1 (col1,col2,col3,...) '"
1. 查看打印结果以及日志输出
|报错，参数值不合法|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

此MR涉及新增配置参数，完成时需更新文档中的参数说明相应内容

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-3-8_14-37-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmNhMWFkOWEzMzExZGM5MzU4IiwicmVmX2lkIjoiNjczOTZkYmM1OTNmOTljOWZmMjM3ZjE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMjEzLCJleHAiOjE3ODIzOTc2MTN9.R653LojNO4B5svtPFTMpSWjn5_ARm9VWXvSozrhGa3o)

 (image/png)    


## Comments:

|  [](null)  ,**progress=true**     一般没有这种用法，都是-p --progress这种表示打开开关了，没有指定就表示没有打开,Posted by heguofeng at 三月 08, 2024 14:57|
|---|
|  [](null)  ,progress = 0 对用户的体验不好。  改为[NULL, DETAIL], 默认值为NULL,缺少自测用例。,进度条 添加统计信息： 导入了多少条，导入失败了多少条，空行有多少条,进度变动触发 进度信息更新,Posted by yezi at 三月 11, 2024 15:33|
