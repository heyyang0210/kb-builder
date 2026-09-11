Created by 王泽凯, last modified on 十二月 22, 2023

*详细设计-YDBRD-24171 : Filter下推 Design*

*IR链接： *    [YDBRD-23847](https://jira.yasdb.com/browse/YDBRD-23847?src=confmacro)    *-*  *Filter下推到窗口函数*  *待RMT评审*

*SR链接：*    [YDBRD-24171](https://jira.yasdb.com/browse/YDBRD-24171?src=confmacro)    *-*  *Filter下推到窗口函数上*  *编码完成*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

当前，对于viewScan内部存在rank函数，并且viewScan有rank函数结果的过滤的情景，并没有做filter相关的下推。这个特性设计将把filter下推成topN值，挂在windowFunc上，并且仍然保留filter将在viewScan。

此外本需求将    [谓词下推框架设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135626077)    此框架合入。当前框架中仅包含这一特性的Filter下推。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

此需求来源于TPCDS性能调优（query 67），简化后语句和相关计划如下。

![](https://pingcode.yasdb.com/atlas/files/public/67396d34a1ad9a3311dc8f84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

可以看到rk的过滤并没有挂在window sort上或者说在window sort多加一个top sort算子（多加算子的需求在    [YDBRD-23933](https://jira.yasdb.com/browse/YDBRD-23933?src=confmacro)    -  增加partition topN功能  开发中  ）。本需求只在window层提供好上层推下来的filter信息。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

当前Oracle对于这种场景已经做了相应的处理。Oracle将ViewScan上的rank filter，推到了window func中。

![](https://pingcode.yasdb.com/atlas/files/public/67396d348970c2af4f521113/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

![](https://pingcode.yasdb.com/atlas/files/public/67396d348970c2af4f521115/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

此处有几个细节需要考虑。

1. 对于>和>=来说，当前oracle是没有做相关下推的。（不下推合理，具体阐述在特性设计中展开）
1. orcale仍然将下推后的filter保留一份在view上。（保留在view上合理，具体阐述在特性设计中展开）


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|Filter下推框架|本框架主要为了后续各个filter下推统一移动到一个地方准备，当前框架内仅实现当前窗口函数的下推。|是|是|
|功能|winFunc下推挂载|当前将和oracle对齐，将filter的信息挂载到window func上，并能通过计划打印出来。|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无。

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

无。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

当前特性仅将filter的信息挂载到window func上，实际仍然还未实现相应执行功能，后续将在    [YDBRD-23933](https://jira.yasdb.com/browse/YDBRD-23933?src=confmacro)    -  增加partition topN功能  开发中  中实现。

此外，本特性仅实现一个较为简单的场景：只有在view内只包括单个和窗口函数相关的filter或者and连接的filter，且filter类型只能是小于或者等于const，窗口函数相关的filter要对应上内部的窗口函数。如下所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396d34a1ad9a3311dc8f86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

对于or连接起来的窗口函数过滤条件，是不可以下推的。

![](https://pingcode.yasdb.com/atlas/files/public/67396d34a1ad9a3311dc8f87/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

当前filter下推框架不再赘述，详见    [谓词下推框架设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135626077)    。

对于窗口函数的下推，下面说明原理和相应的设计。

![](https://pingcode.yasdb.com/atlas/files/public/67396d34a1ad9a3311dc8f88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

### **原理部分：**

**1. 下推原理**

对于rank函数来说，如果外层有对于rank函数的过滤，则可以将外层的filter，转化成一个top sort算子，在执行rank之前执行。这样就使得原本是对全局数据的排序，变成了对部分数据的top n。从而实现性能的优化。

![](https://pingcode.yasdb.com/atlas/files/public/67396d34a1ad9a3311dc8f89/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

**2. 原Filter是否删除**

在filter下推完成之后，会涉及到是否删除原有filter的问题。oracle中对filter是没有进行删除的。

本特性的设计如下：

首先，对于rank() = const这种场景。在下推成top const之后，还需要再view scan层保留一个rk = const的过滤条件，将第const条数据给选择出来。否则结果则会错误。

其次，对于多个窗口的场景，且条件是类似rk1 < 3 and rk2 < 2的filter时。filter是可以在进行下推后，对除了在最上层符合的条件进行保留，其余进行删除。

这是因为窗口函数rank的执行流程如下所示，从下图就可以知道，对于and连接的条件，只能保留上层的。

![](https://pingcode.yasdb.com/atlas/files/public/67396d348970c2af4f521119/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFCQUFBQkFBZ0FBQUFBQUFBQkNCQUFBQUFBQUFBQUFBQkFBQUJBSUFBQUFBSkFBSUFBQUFBQUFBQUFBZ0FBQUNBQUFCQUFBQ0FBQUFBUUJBQUFBQUFBQUFCQ0FBQUFFQUFBQUFBQUFBUUNBQUFBQUFBQ0FRZ0FBQUFBa0FBQUFnQUFBQUFBQUFBQ0FBQ0FBQUFBRUFCQUFnQUFBUUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1NDksImV4cCI6MTc4MjMxNzM0OX0.K4KfQYkCYM0t5y5VfzwenZM48IWqEFLkf1B_r0D-ElY)

### **实现部分：**

**1. view层**

a. 在View层先要将原本的Op上的filter，通过CNF转换，转换之后。直接将整个数组放到ctx中去。之后需要将ctx中的谓词数组进行remap转换。从而使得rk < 3能够转换成rank < 3。做这一步的意义在于使得split时能够更好的判断什么要留在ctx上往下推。什么需要放到op上保留。

b. 在remap之后就进入到split函数，这个函数主要干的事情就是将ctx数组中原本一股脑放进去的filter以及上层推下来的filter，摘出来可以放在本层执行的。并且对于不可以在本层执行，会摘出来放到pOp filter数组上，也就是父亲op上，后续会将这个数组转化成一个result节点。

    b.1 目前做的非常保守，只将view上的rank窗口函数往下推，所有其他ctx上的filter都会留在view上。

c. 之后只需要将摘出来的op数组，再转化成filter树挂在op上即可。

经过这些操作后，view上的rk filter就已经全部放在了ctx上。

**2. select层**

在这一层只做ctx相应的传递。

**3. winFunc层**

a. 由于win层本身没有filter，所以不需要将自己的filter经过转换放到ctx上。

b. 在split中，会将ctx中符合当前win的filter拿出来并且从数组中删除，然后对wind decl的topN进行赋值。并且对于那些不符合的filter，由于本层无法挂filter。会全部放到pOp的filter数组里。

    b.1 当前层实现也较为保守，会将所有当前层无法挂的filter，全部都放到pOp filters上。

c. 对于全部放到pOp的filter，会通过转换，变成result，之后挂到这个Op的上层。

###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

create table test(c1 int, c2 int, c3 int);   ------ organazation by lsc/tac + 单机and分布式

insert into test(1,5);

insert into test(2,4);

insert into test(3,3);

insert into test(4,2);

insert into test(5,1);

----- alter session set degree_of_parallel = 0;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 3;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 3.3;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < -1;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 0;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 <= 0;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 1;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 >= 1;

select * from (select rank() over(order by c2) rk  from test) where rk1 < 3;

select * from (select rank() over(order by c2) rk from test) where rk1 < 3.3;

select * from (select rank() over(order by c2) rk from test) where rk1 < -1;

select * from (select rank() over(order by c2) rk from test) where rk1 < 0;

select * from (select rank() over(order by c2) rk from test) where rk1 <= 0;

select * from (select rank() over(order by c2) rk from test) where rk1 < 1;

select * from (select rank() over(order by c2) rk from test) where rk1 >= 1;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 and rk2 <= 2 and c1 < 5;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 or rk2 <= 2 and c1 < 5;

  


alter session set degree_of_parallel = 2;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 3;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 3.3;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < -1;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 0;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 <= 0;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 < 1;

select * from (select rank() over(partition by c1 order by c2) rk from test) where rk1 >= 1;

select * from (select rank() over(order by c2) rk  from test) where rk1 < 3;

select * from (select rank() over(order by c2) rk from test) where rk1 < 3.3;

select * from (select rank() over(order by c2) rk from test) where rk1 < -1;

select * from (select rank() over(order by c2) rk from test) where rk1 < 0;

select * from (select rank() over(order by c2) rk from test) where rk1 <= 0;

select * from (select rank() over(order by c2) rk from test) where rk1 < 1;

select * from (select rank() over(order by c2) rk from test) where rk1 >= 1;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 and rk2 <= 2;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 or rk2 <= 2;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 and rk2 <= 2 and c1 < 5;

select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 or rk2 <= 2 and c1 < 5;

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

无。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

未实现相应执行功能，后续将在    [YDBRD-23933](https://jira.yasdb.com/browse/YDBRD-23933?src=confmacro)    -  增加partition topN功能  开发中  中实现。

## Attachments:

[image2023-12-12_16-1-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzM4OTcwYzJhZjRmNTIxMTAyIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.mL-j1gQdB2ZPGYgvQfvH_pOESJQY6uKs1VdI-KBC3dE)

 (image/png)    


[image2023-12-12_16-35-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzM4OTcwYzJhZjRmNTIxMTAzIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.N-r8hfk39QVOzJBTw1VnnyReiZM6o0bT0x40XzBoeuc)

 (image/png)    


[image2023-12-12_16-43-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4ZjczIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.qu9U9Bjny4dhS3dNuL5ZR-HiW6nzXKklcCnsHhN60MQ)

 (image/png)    


[image2023-12-14_11-37-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4Zjc0IiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.YDCcM5nuKt75Gobl6Qr780urb0ccTVLfHTPc9QFZf1k)

 (image/png)    


[image2023-12-14_21-10-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4Zjc1IiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.54MYSMVWQl17bHkSTjlSZoRVem2QkH-ogz47jeVhbyo)

 (image/png)    


[image2023-12-14_21-14-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4Zjc2IiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.29SDUYZVJUrK-dorv4ohrZpdAZg5JM1gk6RlaYBjihA)

 (image/png)    


[image2023-12-14_21-27-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4Zjc3IiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.epu_yb94uRVGwYx7crlaC5-04-j2pHIiejcjiuPTtQw)

 (image/png)    


[image2023-12-15_14-45-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzNhMWFkOWEzMzExZGM4Zjc4IiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.G5GvJfRgunmrY_b_lHRaXpGw6b2hx0p_uadoAZThzlE)

 (image/png)    


[image2023-12-15_15-1-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzQ4OTcwYzJhZjRmNTIxMTBmIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.tiRYhuajX6GelYUadHuEzPefnIzo_vnV67LlQzTD-rM)

 (image/png)    


[image2023-12-15_15-13-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzRhMWFkOWEzMzExZGM4ZjdmIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.2U7--zHDPyRwHLE6-2oSsys-tgd7cn9evpgWHqt9Azo)

 (image/png)    


[image2023-12-15_15-57-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzRhMWFkOWEzMzExZGM4ZjgyIiwicmVmX2lkIjoiNjczOTZkMzM3MjgyMDZlZmI5MmYxYzM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTQ4LCJleHAiOjE3ODIzOTI5NDh9.TBS7qPzvQpDMf9ZmeMG27XIrcMuOE54lDMwtyvC8OCQ)

 (image/png)    


## Comments:

|  [](null)  ,与会人：王泽凯，谭思宇，李坤宇，马文英，刘清萍，孔珂煜，陈关羽，周湘松，马士杰，陈敬厅，徐靖怡，吴昊旻    
  会议时间：2023.12.15 17:00    
  会议地点：线下会议,会议纪要：,1. 说明window窗口函数下推原理。
1. 讨论下推时px相关的细节。
1. 说明filter下推框架架构。
1. 说明filter上拉相关原理。
,Posted by wangzekai at 十二月 16, 2023 10:11|
|---|
