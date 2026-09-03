Created by 徐伟, last modified on 七月 12, 2024

# **适用场景：IR/SR特性的详细设计文档**

*详细设计-*  *YDBRD-26562: not in 支持选择HASH JOIN ANTI *  *Design（XXX方案设计）*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b2](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2b2)    *?*    
  *#YASHAN-866 【CCB转需求】not in 支持选择HASH JOIN ANTI*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66260c7cfd997db58adeb4a8](https://pingcode.yasdb.com/pjm/items/66260c7cfd997db58adeb4a8)    *?*    
  *#YDBRD-26562 【CCB转需求】not in 支持选择HASH JOIN ANTI*

##   [1. 总述](#1-总述)  

将not in的改写成anti/rightAnti算子，包括（hash、merge、nestloop）来提高整体执行效率。并且在有关联条件时，not exists也能选择antiJoin

###   [1.1 需求来源](#11-需求来源)  

研发内部需求，在此之前not in只能选择nestLoop，且filter的表示为 !invert(c1 = c2)，选择该算子的原因是之前hashJoin以及mergeJoin对NULL值的处理没充分考虑antiJoin场景；而且这样的执行效率较低，特别是在表中有null值的场景时。

当前实现可以使not in， not exists选择antiJoin，增加优化器的选择路径，从而能使某些语句执行效率更高。

###   [1.2 调研文档](#12-调研文档)  

oracle：    [https://conf.yasdb.com/pages/viewpage.action?pageId=156136379](https://conf.yasdb.com/pages/viewpage.action?pageId=156136379)  

表现总结：

**not in总结：（anti是null敏感的，anti有数据为null整个数据集为空）**

1、当antijoin两边都非空时，显然不需要处理null-aware的场景，即普通anti

2、当anti边为非空时，另一边不能保证非空时，即为anti join sna

3、当anti边不能保证非空时，即为 anti join na

4、当anti有多列时，改写为了not exitst

5、当anti变成rightAnti时，表顺序交换，NA/SNA表示不变。但是实现上不一样，rightAnti需要完整构建hash表，在fetch阶段判断是否存在null去做相应优化

**not exists总结（not exists是null不敏感的，后面的查询只要能返回一条数据（包括null），则当行不返回结果）**

1、当not exists后接查询只返回一条数据且为null时，整个查询返回为空

2、当有关联条件时，not exists也可改成antiJoin

###   [1.3 需求分析](#13-需求分析)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|not in/exists支持hashAnti|hashAnti: 天然支持； hashAntiNa：构建物化区时，有null则构建空hashTable整体返回空，否则按正常antiFetch即可； hashAntiSna： 构建hashTable无需判断NULL； hashRightAnti：天然支持； hashRightAntiNA：fetch阶段判断probe表是否存在空，有的话则优化处理； hashRightAntiSna：build表构建时不插入null值|是|是|
|功能|not in/exists支持nestAnti|对于Na跟Sna需要特殊判断执行filter时结果是否为FR_NULL|是|是|
|功能|not in/exists支持mergeAnti|左边构建物化区的时候不插入null值。  mergeAnti: 天然支持； mergeAntiNa：构建物化区时，有null则构建物化区为空，整体返回空，否则按正常antiFetch即可； mergeAntiSna：构建无需判断null|是|是|
|性能|not in性能提升|1、数据有null 2、之前选择nestAnti，当前选择hashAnti|是|是|
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

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|joinAnti|join的左右两表都不存在空值|是|业界资料链接|
|joinAntiNa|join的右表可能存在空值|是|业界资料链接|
|joinAntiSna|join的右表不存在空值|是|业界资料链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

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

1、不增加join实现，只在当前实现的基础上实现not in的选择

2、优化器对于is not null的判断还不全面，因此基本无法选择出anti跟antiSna计划，基本都选择出antiNa计划；与oracle有差异

3、当有关联条件时，oracle会选择出filter计划；yashan可能会选择出anti

4、not exists也会选择出anti

5、多列not in时按之前实现，即只支持nestloopAnti，不额外新增hash以及mergejoin支持（oracle多列改成filter）

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

**hashJoin支持not in**

1.hashAnti: 天然支持；

2.hashAntiNa：构建物化区时，有null则构建空hashTable整体返回空；反之则按AntiFetch原本流程即可（左表有null不返回，通过makeKey是否有null判断）；

3.hashAntiSna： 需要在trsfMat增加标志位，构建hashTable无需判断NULL；AntiFetch中左表有null不返回，通过makeKey是否有null判断

4.hashRightAnti：天然支持；

5.hashRightAntiNA：build表物化时插入null(因为probe可能为空表）；fetch阶段判断probe表是否存在空（makeKey是否有null），有的话则优化处理；如果没空，则在最后遍历build表时，需要判断未被访问的key是否有null并且probe不为空，此时该行才不被返回，否则返回该行，

6.hashRightAntiSna：build表物化时插入null，probe的优化同rightNa；由于build表中不可能存在null，所以最后fetchNotVisited即可

###   [4.2 特性功能点2](#42-特性功能点2)  

**nestloopJoin支持not in**

1、nestLoopAnti:天然支持

2、nestLoopAntiNa：AntiFetch中左表有null不返回，通过FR_NULL判断

3、nestLoopAntiSna：AntiFetch中左表有null不返回，通过FR_NULL判断

###   [4.3 特性功能点3](#43-特性功能点3)  

**mergeJoin支持not in**

mergeJoin特殊性：该算子有两个算子构成，mergeJoin+mergeSort；物化在sort层，运算在mergeJoin层。正常如hashjoin当右边存在null值时，整个joinStatus = EOF；但是由于merge有两层算子，当右边为空的时候，如果右边的物化区为空，会导致左边去匹配时，将左边全部输出。即右边为空无法表明是右边没数据还是整个结果集返回为空，该信息无法传递给join算子。

1、在实现上需要将null值插入到右边（anti+na场景），并且在mergejoin上记一个标志位，如 c1=c2场景，假如c1<c2，之前逻辑是c1这条记录返回，因为c2后面的值一定大于c1，不可能满足。但是由于存在了null（anti+na插入），需要继续匹配，因为有null时c1这条记录不返回

2、左边构建物化区的时候由于可能右边结果集为空，此时可以返回NULL值； 因此在左边构建物化区时需要插入null。

a. 而对于左边的null是否能返回，则需要判断，如果是mode=anti，说明左边要么是isNotNull选择的（左边物化区一定没null），要么是not exists或者not in的关联filter改写的，此时null就能正常返回。

b. 如果mode = na，说明左右都可能插入null，fetch阶段execMjCmp发现key的右表存在null时，整个返回空集；如果左边为null，joinmode为anti直接返回数据；但是为antiNa，则该数据不能被返回（右边为空表时在上面判断已经能够全部返回）。由于null在最后，在非null匹配失败时不能一步优化，具体如下：

```
  . 在等值以及大于等于条件以及大于时如果左边的不为null且小于右表，如果是nullAware，则不能直接返回左边数据（因为右边可能为null）
  
  . 在小于以及小于等于条件是，如果左边不为null且小于右表，如果是nullAware，则不能直接返回左边数据（因为右边可能为null）

```

mergeAnti: 天然支持；

mergeAntiNa：构建物化区时，有null则构建物化区为空，整体返回空；无NULL则在fetch阶段判断左边是否存在空，有空则makeKey的时候不插入NULL

mergeAntiSna：构建无需判断null，其余按正常fetch流程即可

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

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

## Attachments:

[image2023-6-2_15-22-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDI4OTcwYzJhZjRmNTIxNTYzIiwicmVmX2lkIjoiNjczOTZkZDE3MjgyMDZlZmI5MmYyM2IwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExODk3LCJleHAiOjE3ODIzOTgyOTd9.ckl7TqFqiNLR3tLEF1oGKtIaTGzd9ouC-KYkpG-7Tu0)

 (image/png)    
