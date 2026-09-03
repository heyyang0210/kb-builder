Created by 朱月婷 on 四月 22, 2024

*详细设计-YDBRD-27844: DBLINK支持SEQUENCE Design*

* IR链接：*    [YDBRD-27844](https://jira.yasdb.com/browse/YDBRD-27844?src=confmacro)    *-*  *崖山DBLINK连接ORACLE支持SEQUENCE*  *设计中*

*SR链接：YDBRD-XXXX*

##   [1. 总述](#1-总述)  

DBLINK支持SEQUENCE。

###   [1.1 需求来源](#11-需求来源)  

需求来源：深燃二期

场景：工程移动系统与ERP强关联，大量dblink用法与Oracle进行交互

交付形态：单机

需求规格：

```
CREATE SYNONYM "SUPERVISETEST"."CUX_JL_PROJECT_VISA_S" FOR "CUX_JL_PROJECT_VISA_S"@"APPSLINK";
--seq作为insert values，CUX_JL_PROJECT_VISA_S为远端的SEQUENCE
insert into remote_table values( CUX_JL_PROJECT_VISA_S.nextval);  
--seq作为查询的投影列，cux_jl_wf_activity_s为远端的SEQUENCE
SELECT cux_jl_wf_activity_s.nextval FROM DUAL;

```

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=147770796](https://conf.yasdb.com/pages/viewpage.action?pageId=147770796)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|select语句：支持sequence作为投影列|子功能1通过什么方案满足|是|是|
|功能|insert语句：支持sequence作为insert value|子功能1通过什么方案满足|是|是|
|功能|update语句：支持sequence作为set value|子功能1通过什么方案满足|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

暂无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

暂无，与当前sequence使用场景保持一致。

##   [4. 特性](#4-特性)  

暂不考虑同义词实现方式，仅实现a.b@c的形式。

关注场景：

|dml场景|小项|方案|备注|  
|
|---|---|---|---|---|
|insert|seq作为建表默认值，执行insert语句时不填充该列|由远端做填充，本地指绑定已指定的Colum|预期应天然适配（无环境，待验证）|  
|
|  
|seq作为insert value，如insert into t1 values(seq.nextval);|通过select seq.nextval语句，查询结果到本地进行绑定|不支持跨link|  
|
|  
|seq作为投影列，如insert into select seq from tab|绑定参数，通过fetchProj获取数据|获取seq数据复用select语句逻辑|  
|
|select|seq作为投影列或函数参数，seq的数据条数应与最终结果集条数一致|返回多行记录时，在sendRow时执行seq表达式时，发送select seq from dual语句获取当前值|无论seq和tab是否跨link，都走该种形式，当语句中出现多个seq，对于属于相同link的需要合并查询，则涉及到状态切换，该seq在本行中是否已查询。,是否存在更好方法？待调研。|server拼好sql发给yex，yex无需concat sql，发送往远端，接收并返回数据给server。|
|update|seq作为set value|当前update通过去掉linkName，将语句发送到远端执行,  
|不支持跨link|  
|
|  
|seq作为filter|不支持，进行报错|  
|  
|
|delete|seq作为filter|不支持，进行报错|  
|  
|
|merge|  
|不支持|  
|  
|


|进程|阶段|描述|分析|方案|问题|备注|
|---|---|---|---|---|---|---|
|server|parse|**语法：**  seqName.currVal/nextVal@dblink_name,**自验场景：**  表和seq远端/本地的，正交使用|以proj为例，当前对于其parse为parseExpr流程，最终走入lexFetchVariant流程，预期有三个item,存在问题：考虑udt形式，在外部以item的个数判断存在问题，但内部无法将可能为dblink的信息带出，如果考虑在外部做，应该也只是修改parseExpr等流程。|lexer修改：如果在读到a.b[.c]后，读到@符号，将word.isLink记为COD_TRUE，并返回,parser修改：parseExpr时，如果是isLink，将linkName解析出来，如果是d.e的形式，将其整个挂在一个item上。,  
,由于首先会解析成columnExpr，整个items将会被copy到nameExpr中|  
|  
|
|  
|verify|对于sequence，需要校验该对象是否存在，考虑sequence达到上限会报错的场景，verify阶段是否会提前获取报错？  --不报错，交由真正执行时，|无论sequence出现在语句的何种位置，都需要校验是否存在,执行时要区别于一般的sequence，即首次执行需要seqDc，第二次从preProjValue中取,当前普通column区别于dblinkColumn是通过vColumn上的type，如果是sequence，需要也给一个type，但是在verify中就不是通过判断是dblinkTable进入流程了，而是只跟sequence相关。|或在exprNode上增加isLink标志位，用于区别普通seq和dblink seq,每一个seq都会openLink，检查yexKey，是否有属于同一link的seq，在后续拼接sql时用一条语句发出|  
|  
|
|  
|exec阶段|对于table，根据isLinkTable判断走何种流程|如果是seq，应该需要关注执行seq的expr就行|根据vSeq的type进行判断，preProj的判断优于type的判断|  
|  
|
|yex_server|  
|  
|  
|1.增加ylnSeq结构体，挂在ylnCursor上，与table为一个union,2.增加对于seq信息的读取流程，用于检验seq是否存在,3.将属于同一个link的seq拼接在一条语句上发出,4.获取数据发往服务端|ydbcStmt上的columns根据远端数据库为OraColumn或YsColumn=|  
|


**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**  针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

*关键技术点展开要借鉴结构化分析或者UML工具，设计方案优选用图，要求如下（理论指导的斜体内容在正式文档可以直接删除）*  各图如何画可以用参照链接     [https://conf.yasdb.com/pages/viewpage.action?pageId=135603021](https://conf.yasdb.com/pages/viewpage.action?pageId=135603021)  

*1）结构化设计方法：数据流图 + 状态转换图 +  ER图*

*2）UML工具呈现4+1视角*

```
用例视图：用例图（通过 场景描述，以及对应场景下的设计方案，也可以直接用例描述）

逻辑视图：类图/对象图/构件图/包图（特性下各模块的分工配合）

实现视图/进程视图：顺序图/活动图/状态图/定时图（详细设计文档更为关注、概要设计多为特性框架视角）

部署视角：部署图 （子特性不涉及，总体设计文档涉及）

```

**图为工具也是编码的抽象，便于项目干系人（TL/SE/PL/MDE/开发人员）理解特性的实现方案原理。**

###   [4.1 特性设计](#41-特性设计)  

*场景描述，通过用例图，或者通过用例描述。必选*

*静态组织结构，通过逻辑视图或者ER图呈现。*

*建议选用数据流图、流程图或者活动图说明清楚特性处理流程，涉及多线程/多对象参与的，可增加顺序图/时序图。必选*

*存在状态机切换的，需要考虑状态转换图或者状态图。*

**详细设计和概要设计的主要区别是通过详细设计方案指导代码可落地。所以要具体到代码的数据结构、代码流程指导和跟框架如何结合。**

*如果概设和详细设计统一，需要展开对各SR进行阐述*

###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. [seq，tab] [local,remote] 正交测试
1. [yasdb] [oracle,yasdb] 正交测试


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。