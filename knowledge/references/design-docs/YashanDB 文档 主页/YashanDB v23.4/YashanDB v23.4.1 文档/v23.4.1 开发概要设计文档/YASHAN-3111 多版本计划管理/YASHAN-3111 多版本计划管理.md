Created by 徐晓锋, last modified on 十一月 13, 2024

*概要设计-YASHAN-3111 常量参数化与基于参数的计划管理 *

*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66c1aac05808037af126b20e](https://pingcode.yasdb.com/ship/ideas/66c1aac05808037af126b20e)  *?*    


##   [1. 总述](#1-总述)  

缓存SQL的计划是减少语句执行开销很重要的一环，如何尽可能的最大化缓存语句计划同时又保证计划参数值的多计划选择为最优的，是数据库开发设计中很重要的一个模块。本文对计划管理与选择问题进行分析与设计规划。

###   [1.1 需求来源](#11-需求来源)  

**数据库用户产生的SQL语句，从SQL复用度上可以分为两大类：**

####   [1.1.1，基于绑定参数的语句](#111基于绑定参数的语句)  

```
   select * from t1 where c1 = ?;   
```

这类语句在编译时，SQL的输入文本是一致的，可以较容易的判断复用之前曾经执行过的语句的一些编译资源，所以数据库会缓存对应的资源，采用一次编译，多次执行的方式以减少编译资源的开销。  
优点：可以最大限度的节省编译成本，包括减少编译次数，节省编译内存等。
缺点：计划生成时，无法得到参数对应的取值，所以对统计信息评估可能不够准确，可能生成较差的计划，另外，当输入的参数值不同时，如果需要不同的执行计划，则该方式无法为每一个特定的参数生成一个最优计划。

####   [1.1.2，基于固定值/程序动态拼装的语句](#112基于固定值程序动态拼装的语句)  

```
   select * from t1 where c1 = 5;   
   select * from t1 where c1 = 6;    
```

这类语句在编译时，可以明确的知道语句中的每个取值，所以对于统计信息的评估对比参数来说，是更为精确的。

优点：每个语句都可以是基于自己条件的最合理计划。

缺点：语句个数与业务数据关联，可能产生非常多不同的语句，计划复用度较低，内存开销要求高。

以上两种方式，每个场景都有自己的优点和缺点，基于当前状况，需要设计一种方式，既可以支持只有常量不同的语句既可以匹配到相同的计划，也可以根据参数不同匹配到不同的计划，从而尽可能利用优点，规避缺点，是这个设计分析的重点。

###   [1.2 调研文档](#12-调研文档)  

调研Oracle游标共享与SPM。

1，了解Oracle是如何解决这类问题的。

2，通过对Oracle的调研，印证设计可行性。

###   [1.3 需求分析](#13-需求分析)  

**针对如上的两个场景，分析最佳模式：**    
假设语句为: select * from t1 where c1 = XXX，c1有n个不同的取值而且都可能被访问到。
如果采用完全绑定参数匹配的方式，只需要根据绑定参数产生1个计划；如果每个值不同，计划都不同，则需要n个计划。但在很多场景下，输入不同的值，他们生成的计划是可能相同的（也可能不同），所以本质上，对于这个场景，我们可以假设一定存在k个最优计划（1 <= k <= n），n个值中任何一个值的最优计划都可以从这k个计划中找到。

所以解决这个问题就演变为，根据输入的语句和对应的可变量，如何寻找产生k个最优计划并且为每个不同可变量寻找其最优计划的过程。

**过程细化分解，分为如下步骤：**    
  **1，将不同的输入语句识别为只有字面量不同的相同语句，定义字面量的替换规格。**    
  客户输入的文本可能是五花八门的，如果将不同的文本识别为相同的东西，为了简化匹配规则，首先需要进行一个标准化的过程，比如，SQL文本非字面量是不区分大小写的，我们就可以统一标准化为大写格式，非字面量中的回车，空格是等价的，则可以统一替换为一个格式。    
  将不同的字面量识别为一类，需要进行字面量的替换，替换为内部绑定参数的方式。举例如下：

```
   Select * froM t1     where  c1 = 5;
   select * From T1 where   c1 = 6;
      ==>SELECT * FROM T1 WHERE C1=:SYS_B1    
```

注：对于用户精确匹配，不在本次范围内，规划未来的IR承载。

**2，针对不同参数，实现多个计划的管理。主要逻辑如下：**

之前的设计，SQL和Plan的匹配关系为1 : N，所以可以直接挂在anlcontext上，做语句匹配后的二次查找。

通过SQL文本和一部分变量，做Anlcontext的Hash查找，然后再通过另外一个Hash查找，批配到具体的计划。

![image.png](https://pingcode.yasdb.com/atlas/files/public/673ae4b08970c2af4f53b4f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUFDQUFnQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFnRVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1OTYsImV4cCI6MTc4MjQ2NzM5Nn0.lyqFtPUdP-IJyQY_jwQkQBHjf0uqf8rtlWwdfXIA3nw)

新设计语句和Plan的关系为N：N的关系，这需要调整查找关系，Plan的查找不依赖anlcontext的查找，需要调整当前PlanCache的实现。

![image.png](https://pingcode.yasdb.com/atlas/files/public/673b0a6da1ad9a3311de3389/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUFDQUFnQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFnRVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1OTYsImV4cCI6MTc4MjQ2NzM5Nn0.lyqFtPUdP-IJyQY_jwQkQBHjf0uqf8rtlWwdfXIA3nw)

主要调整点：

A，增加PlanManager，做为计划管理模块，负责生成计划，销毁计划等工作的承载，也会负责将来计划的演进，比如基于baseline的计划演进，基于版本的计划选择等。调整整理计划对应的选择Key。

SQL到Anlcontext，AnlContext到PlanGroup对应的HashKey的规划调整。

例如：不同用户的相同计划，暂不考虑，后续可按新优化需求处理。统计信息的因子需要放到PlanGroup选择计划的模块中等。

B，增加PlanGroup，管理语义上相同的语句产生的多个计划，当group中的值为1时，行为和过去完全一致，所有的绑定参数都匹配到同一个计划。当大于1时，将会为一个语句产生多个可以执行的相同的计划。

C，调整Param模块，过去的Param，主要指外部输入的参数，开启语句的字面量替换后，需要增加新类型字面量替换的Param，其基本行为和用户外部输入的参数类似，在计划管理上，可以为不同的值生成几类可共享的计划。同时将子查询或者nestloop join的引用，也纳入到Param的统一管理中。

D，细化调整1级查找与2级查找的因子。比如：统计信息的变化，索引的变化（增加索引和删除索引可能是不同的影响），物化视图的变化等，是否还需要对应生成新计划。渐进式调整。

**3，计划产生和选择的算法：**

目前方法上暂不确定的一块。计划采用演进的方法。从简单的方法入手，逐步演进到逼近最佳的方式。接口设计固定，可以嵌入任何分类选择算法。需要确定的点主要有两个：

A，触发生成新计划。自动还是手动？

      语句是否符合生成新计划的条件。

      确定生成的计划是一个全新计划。

B，选择不同计划。

     选择因子与算法。    

C，进化计划。

      执行反馈用于产生新计划。

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**增加开启与关闭共享的外部参数设置，设置分两个级别：**    
级别一：开启SQL语句标准化
级别二：开启SQL标准化与常量替换

**增加PlanGroup中Plan个数的参数设置：**

设置每个Group中最多的Plan上限制，为了避免无效计划的产生，减少plan内存的使用，增加plan命中的可能性。

##   [3. 规格与约束](#3-规格与约束)  

**1，SQL标准化规格：**    
非敏感的字符，统一转为大写格式。

非敏感的空格，回车和Tab，统一转为一个空格的方式。

补全对象标识符，不同User/Schema可以复用相同计划（本IR暂不实现）。  
  **2，常量替换规格：**    
A：对部分Filter中出现的常量，进行常量替换为系统自定义参数的方式，其他位置的常量，不进行处理，根据使用的主要场景(投影列中引用参数然后上层过滤的场景，较少且不具备通用性)。
B：比较操作符（=, !=, >, >=, <, <=），一边为纯常量（表达式中含有常量不可以），另外一边包含列，Rownum，rowid时，则进行替换。
C：Like/Not Like/RLike/Not RLike，左边表达式包含列，右边表达式为纯常量时进行替换。
D：In/Not in常量列表，左边包含列，rowid，右边为常量列表，且所有的常量数据类型一致时，进行常量替换。
E：Any/All后面出现常量列表，左边包含列，rowid，右边为常量列表，且所有的常量数据类型一致时，进行常量替换。
  **3，不同常量/绑定参数值的多计划选择**    
实现将计划分组，不同的绑定参数映射到不同的分组，根据分组，取得其对应的计划。分为两大部分：
A：不同分组计划的管理。
B：参数映射到分组的方法。

##   [4. 特性](#4-特性)  

**为了更好的实现以上功能，需要对当前代码进行的如下几个方面进行调整。**    
  1，PlanCache的设计调整，增加计划管理和计划组管理。    
  2，AnlContext对应的重用调整，解绑anlcontext和plancontext。    
  3，参数部分的统一规划和调整，增加param类型，实现各种类型param的接口。    
  相关模块设计如下：    
  **1，SQL文本管理模块：**    
  负责SQL语句管理与标准化相关的功能。

**2，PlanManager计划管理模块：**    
负责计划插入，删除，清理等计划管理任务。主要接口有：         

![image.png](https://pingcode.yasdb.com/atlas/files/public/673ae97fa1ad9a3311de334f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUFDQUFnQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFnRVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1OTYsImV4cCI6MTc4MjQ2NzM5Nn0.lyqFtPUdP-IJyQY_jwQkQBHjf0uqf8rtlWwdfXIA3nw)

PlanManager中保存查找计划需要的HashMap，HashMap每个成员上对应一个语句在一个特定环境和设置下的计划。  
计划按照两个维度来管理
  **1), SQL文本与属性**  ：  
HashKey设置为：sql文本/标准化后的文本，计划相关的环境变量，外部输入参数的数据类型。
HashValue为对应的PlanGroup。
  **2), 对象（本次IR只调整文本部分的匹配，不增加基于对象的管理，未来规划）：**    
HashKey设置为对应的对象（主要是表，视图等查询使用的数据库对象）HashValue为对应的PlanGroup。

主要的功能如下：  
插入计划：查找计划所在的group，如果group存在，则在插入到group中，如果group不存在，则先生成对应的group，再在group中插入对应的计划。
淘汰计划：
淘汰计划，是以group为单位的。如果淘汰某个计划，则淘汰整个group。清理计划（待定）：
A，手工方式清理部分计划，与当前fulsh功能一致。
B，按照对象清理计划，主要用于清理对象无效后的无效计划（本次IR的交付暂不包含此内容）。
C，清理整个PlanCache（本次IR的交付暂不包含此内容）。
增加PlanGroup：
淘汰PlanGroup：
淘汰后，将PlanGroup挂在到一个空闲可用PlanGroup链表上，为重用其内存做准备。
重用PlanGroup：
因为当前Memorycontext无法单独释放，为了最好的利用计划的内存，淘汰掉计划其内存初始化后放置到一个列表上。注意：为了更好的重用Group，PlanGroup必须为大小固定的结构体！

**3，PlanGroup模块：**    
PlanGroup对应着一个语句可替换的计划组，在一个group中选择任何一个计划都是可以执行的，可以根据不同的分组算法，或者不同的版本来管理和选择计划。
PlanGroup按照如下两个维度来管理计划：
A，按照版本管理计划：
B，按照分组选择计划：
待确定问题，初步计划用小模型实现：
不同的参数值进来后，如何触发产生不同的计划分组，分组算法/模型的确定过程。
如果计划的两个分组，计划是一致的，是否需要合并分组？需要分组算法产生另外一个新计划组吗？
PlanGroup的主要成员有：
A，Plan数组，代表分组的个数，可以根据参数设置。
B，指定版本计划，如果指定了改语句计划的版本，则按照指定版本的计划进行。
针对不同的常量值，可能使用不同的计划，将常量进行分组，然后根据分组算法，选择最终使用分组中的哪一个计划。

**4，Param模块：**    
参数分为三个大类：
A，用户SQL层输入的参数
B，子查询或者nestloop join生成的外部引用转化的参数
C，常量替换产生的Filter中的参数（完全按照常量处理，任何阶段都可以执行）

###   [4.2 特性周边配合](#42-特性周边配合)  

####   [4.2.1 计划准确度的影响和调整](#421-计划准确度的影响和调整)  

如果是生成计划，调整统计信息相关的计算，计划的filter中，保存的需要是参数类型，但是计算的时候，依然按照常量的真实值计算其统计信息。生成的计划需要对应到group中的某个分组中。

####   [4.2.2 DFX的影响](#422-dfx的影响)  

|类别|子类|分析|结论|
|:---|:---|:---|:---|
|DFX|可靠性|不涉及|不涉及|
|  
|可用性|对客户透明|不涉及|
|  
|性能|Plan查找路径变长，管理内存使用稍有增加，整体内存使用下降。|需要进行性能测试设计|
|  
|安全性|只涉及SQL执行计划的选择和执行|不需要进行安全特性设计|
|  
|易运维|A，SQL文本相关的V$视图：Sql文本显示相关的视图，对应显示语句的调整。  
B，AWR报告：sql语句的执行时间和统计次数，需要根据plangroup的粒度进行（标准化后的文本粒度），以便正确的统计同类sql的占比。本次IR不包SQL分的调整。需要一个任务调整该部分该部分内容。
C，错误信息输出：错误输出位置，永远以原始sql为准，参数化不能影响到报错位置的变化。|涉及运维新观测维度增加，需要建立新IR在做对应的功能开发，本IR不包含。|
|  
|兼容性|不涉及|不涉及|




##   [5.未来规划](#5未来规划)  

1，计划管理实现基于对象的管理内容。

2，计划管理增加动态内存申请和释放相关的内容。PlanCache的内存和其他内存可以互用。

3，Group管理算法演进，包括Group中相同计划的处理，group中不同计划分组算法的演进等。

4，AWR中统计粒度增加，基于标准化后的文本统计，以及相关视图中文本内容的调整。

5，LRU淘汰算法优化，尽可能保证不会被使用到的内容优先及时的淘汰出去，Plan引用的生命周期细化。

6，SQL复用扩展，不同的用户，相同的语句，可以识别为相同的语句，别名不同不影响等价性等。

7，计划演进，当产生的计划不是最优计划时，通过执行反馈调整计划。稳定计划，计划导入导出，计划迁移能力，系统升级或者其他场景。



