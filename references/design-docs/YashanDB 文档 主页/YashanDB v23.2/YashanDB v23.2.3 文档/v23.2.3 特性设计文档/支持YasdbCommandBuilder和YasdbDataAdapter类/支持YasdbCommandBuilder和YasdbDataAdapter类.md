Created by 方少奎, last modified by  杨德柳 on 十月 24, 2024

  


* IR链接：YASHAN-2853*

*SR链接：YDBRD-26673*

##   [1. 总述](#1-总述)  

yashandb-dotnet支持YasdbCommandBuilder和YasdbDataAdapter类。

YasdbCommandBuilder对象在更新数据库时为YasdbDataAdapter自动生成SQL。

YasdbDataAdapter对象表示一个数据提供程序对象，用于填充DataSet并将DataSet中的更改更新到Oracle数据库。

YasdbDataAdapter实现Fill和Update接口。

###   [1.1 需求来源](#11-需求来源)  

Yashandb支持.NET驱动。

###   [1.2 调研文档](#12-调研文档)  

  [Oracle-dotnet特性调研](https://conf.yasdb.com/pages/viewpage.action?pageId=152995564)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
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


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

YasdbCommandBuilder类

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|YasdbCommandBuilder(YasdbDataAdapter)|----|构造函数|是|
|ApplyParameterInfo(DbParameter parameter, DataRow row, StatementType statementType, bool whereClause)|----|分配参数信息|是|
|GetParameterName(int parameterOrdinal)|返回string|返回参数名称|是|
|GetParameterName(string parameterName)|返回string|返回参数名称|是|
|GetParameterPlaceholder(int parameterOrdinal)|返回string|返回参数占位符|是|
|SetRowUpdatingHandler(DbDataAdapter adapter)|----|注册委托事件，行更新时Command实时更新|是|


YasdbDataAdapter类

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|YasdbDataAdapter()|----|构造函数|是|
|YasdbDataAdapter(YasdbCommand selectCommand)|----|构造函数|是|
|YasdbDataAdapter(string command, YasdbConnection con)|----|构造函数|是|
|YasdbDataAdapter(string con, string command)|----|构造函数|是|
|OnRowUpdating(RowUpdatingEventArgs value)|----|触发行更新事件，执行委托|是|
|Dispose()|----|释放Command资源|是|


##   [3. 规格与约束](#3-规格与约束)  

支持对dataset的增删改。

##   [4. 特性](#4-特性)  

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

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。