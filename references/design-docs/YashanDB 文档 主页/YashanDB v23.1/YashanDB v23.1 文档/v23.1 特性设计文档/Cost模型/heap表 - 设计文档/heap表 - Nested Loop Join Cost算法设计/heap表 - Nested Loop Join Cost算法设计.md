Created by 王泽凯, last modified on 七月 11, 2023

# **适用场景：IR/SR特性的详细设计文档**

**注：成熟模块的特性**  建议概要设计和详细设计可合一，所以特性设计文档中描述的要素需全面。

**       关键特性**  需要有IR层级的概要设计和SR层级的详细设计，此文档主要关心SR层级的详细设计，IR概要设计文档已承载的功能拆分和架构说明可不赘述，通过链接说明。

*---------------以下为正文开始分隔线-----------------*

#   [YDBRD-XXXX : XXX Design（XXX方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：YDBRD-XXXX / SR链接：YDBRD-XXXX

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#1-overview%E6%A6%82%E8%BF%B0)  

本设计文档用来设计所有Nested Loop Join算子的cost算法

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### **2.1 Nested Loop (index、Outer) Join COST 算法设计**

  Nested Loop Join COST 算法

总体公式如下： PS：现在nested loop只有left outer， right也会转成left

![](https://pingcode.yasdb.com/atlas/files/public/67396a1ca1ad9a3311dc7a95/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBSUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBakJBQUFBS0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBUUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MDEsImV4cCI6MTc4MjIyMjIwMX0.LlapIxHUPkM3L1pYAwPgMrpukFPiMG__uiLmf3-IW4A)

公式解析：

Nested Loop Join Cost一共有两大需要考虑的模块：CPU + IO

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|CPU    
    
    
|Read 、Filter    
    
|同Scan的相同，不再赘述|-|-|
|IO,  
|IO times、Block Size|需要读取的IO次数和block数,由下面因素决定：,1. 换入换出次数
|-|换入换出次数：,- 算法1：对于不同extent的block，认为换入换出的概率不同，（越小的extent，在预读后越容易换入换出，因为越靠前），且认为都是单块读。以此来计算IO次数（概率的合）。
- 算法2：直接用一个统计出来的Factor，对右表总共的IO cost进行相乘。
|


Nested Loop Index Join COST:

几乎和上面的算法是一样的，唯一有区别的就是Block数，index scan的block数不是全表的block数，而是经过index后的block数，且由于是单块读了，没法用extent的大小来描述先后顺序，换入换出的影响只能用算法二。

![](https://pingcode.yasdb.com/atlas/files/public/67396a1c8970c2af4f51fc20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBSUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBakJBQUFBS0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBUUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MDEsImV4cCI6MTc4MjIyMjIwMX0.LlapIxHUPkM3L1pYAwPgMrpukFPiMG__uiLmf3-IW4A)

此外对于nested Loop Index Join 下的Index Scan，其cost要受到join condition的影响，应该正相关与图上所示。并且在算Join Filter CPU cost时，不应该再包括推下去的Filter。

Outer和普通的没有区别。（decode和补空，忽略不计）

### **2.2 **  **Nested Loop Full Outer Join COST **  **算法设计**

  Nested Loop Full Outer Join COST 算法

总体公式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396a1ca1ad9a3311dc7a97/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBSUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBakJBQUFBS0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBUUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MDEsImV4cCI6MTc4MjIyMjIwMX0.LlapIxHUPkM3L1pYAwPgMrpukFPiMG__uiLmf3-IW4A)

公式解析：

Nested Loop Full Outer Join Cost一共有两大需要考虑的模块：CPU + IO

Full Outer的执行流程是先把右表物化下来，然后对左表left outer，并在fetch的过程中对右边进行记录，最后再遍历一遍右边输出右边完全没匹配上的值。

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|CPU    
    
    
|Material|Full Outer需要物化右表的数据|execNestLoopFullOuterJoin|这一块流程较多，主要有几个因素需要考虑：,1. 分配前的换入换出（不一定有）
1. 分配内存空间大小的消耗，alloc
1. 分配时并行度的加速
1. 拿值放入vm的消耗
,分层两部分来计算，第一部分是1，这个可以看Swap_Vm_cost。,第二部分是2，3，4，这个直接测出来两个unit（或者做再细一些，每个alloc和put等，都列出来）。|
||Material_Scan_CPU_cost    
    
|在对Material的数据进行fetch的时候，是从VM上拿，而不是从buffer pool上拿。,  
|-|这个需要测试得出。本质上可以拿scan的cost进行复用。|
|IO,  
|Swap_Vm_cost|Vm换入换出需要计算的cost,由下面因素决定：,1. 换入换出次数
|-|换入换出次数：,- 直接用一个统计出来的Factor，对总共有多少个64K的block相乘，得到换入换出次数。
,Vm cost：,- 测出每64K block需要多少cost。
|


### **2.3 **  **Nested Loop Semi / Anti (index) Join COST **  **算法设计**

  Nested Loop Semi / Anti (index) Join COST算法

总体公式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396a1ca1ad9a3311dc7a99/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBSUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUVBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBakJBQUFBS0FBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBUUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MDEsImV4cCI6MTc4MjIyMjIwMX0.LlapIxHUPkM3L1pYAwPgMrpukFPiMG__uiLmf3-IW4A)

公式解析：

Nested Loop Semi / Anti Join Cost一共有两大需要考虑的模块：CPU + IO，本质上和最初的nested Loop几乎没差别，唯一的差别再rows上

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|CPU    
    
    
|Read 、Filter    
    
|大体同Scan的相同，不再赘述,唯一不同：,- 匹配条数
|-|由于Semi和Anti都会提前返回，所以匹配条数需要另外确定：,- 对于match条件的
    - Semi：会提前返回，但提前多少返回，无法确定，定了个0.5。left_rows * selectivity * right_rows * 0.5。
    - Anti：逻辑同上，为left_rows * （1 - selectivity） * right_rows * 0.5。
- 对于不match条件的
    - Semi：会全部扫完。left_rows * （1 - selectivity） * right_rows。
    - Anti：逻辑同上，为left_rows * selectivity * right_rows。
|


Nested Loop Semi / Anti Index Join Cost：

除开和普通nest loop一样会影响filter和block数之外。Semi和Anti还会影响rows。right_rows直接置为1即可。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#55-%E5%85%B6%E4%BB%96)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1. 表达式类型带来的投影/filter cpu开销差异
1. bufferpool 换页算法(1.用cr；(2.tablescan单独buffer
1. pxblockitor划分range时的开销
1. 预读上来的block，不同线程能不能访问(影响非首线程的io次数)
1. partScan基数估计问题。


## Attachments:

[image2023-4-28_15-46-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTdmIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.M36JtUkgC7olkwb2B44novl6UXEK3YxY4sE50EYkN8M)

 (image/png)    


[image2023-4-28_15-38-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTgwIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.38U08KfzqEH2N2b219VMu8GrEd4NWElMSuTxv7MNaqo)

 (image/png)    


[image2023-4-28_15-36-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWE4OTcwYzJhZjRmNTFmYzBhIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.C81WWfRyML479QwPBRf4DSknGsJJvSHItn-ycT2EqLA)

 (image/png)    


[image2023-4-28_14-52-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTgxIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.wscHRVgfTfmxP2GPAqM9WHsRztzM-67V21PSgdZt2xg)

 (image/png)    


[table_full_scan.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTgyIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.Oaf5tx5EMkJ4ZlibdJrant-faX5a3OI2-vRO2ye5H68)

 (application/octet-stream)    


[image2023-4-28_14-38-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTgzIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.ut_ng-faUovntYQTJmbj2P142uS39Yb8839L4fC_hf4)

 (image/png)    


[index_scan_cost.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWE4OTcwYzJhZjRmNTFmYzBiIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.N2-_sQP1TEtYm6N6KqW1jN4p-x2-i3yuvLqc7luOQTo)

 (application/octet-stream)    


[image2023-4-27_11-56-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWFhMWFkOWEzMzExZGM3YTg0IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.L8rE0JpFNh3m0wxFF-AHD25iQRfV_-7fMcZMkFw9ePw)

 (image/png)    


[image2023-4-27_11-12-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWE4OTcwYzJhZjRmNTFmYzBjIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.dvWuC0qR99pqj8XGa-hUyAzuc6xN8qySHmkXFgf_vM0)

 (image/png)    


[image2023-4-27_10-55-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzBkIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.S-CV1KoUoCDNEt-41MC8usE-HJ205B9T5QaraRNOJn4)

 (image/png)    


[image2023-4-27_10-40-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzBlIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.-hAezl6SFe0muYrY9AtM9J_e8A_IeVlvGO5zfrJFkCs)

 (image/png)    


[image2023-4-27_10-10-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YTg1IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.GJ5G5ukuBmeB6NKEjao-E8tK19IsIK9f2qdTsWLUxdo)

 (image/png)    


[image2023-4-26_19-51-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzBmIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.eaix5qBikfdkxJDC2gsBI68RVCiU4_HRVNPKlsw938o)

 (image/png)    


[image2023-4-26_19-32-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzEwIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.aOK5c31mdr1-NpGJ7sdrgsvxFGZl4bWY65qkfT84qsA)

 (image/png)    


[image2023-4-26_19-32-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzExIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.eV5G55j1JC4cXRA5-Mux-imovmVPuYNiUBqHMUo55kE)

 (image/png)    


[image2023-4-26_19-32-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YTg2IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.vXAV-kGS6d_79nE6ErO064ugUJ5vcPIi-ub9ZXqwc5w)

 (image/png)    


[image2023-4-26_19-17-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzEyIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.n_mEZVHlm_cQVT3bB76xfX5tcxZPlgfJ44--vZ3a44o)

 (image/png)    


[image2023-4-26_19-16-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YTg3IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.SFTrPPm7yHufhrwUCR5val5q70GKxMQO7BdtTfcPhvU)

 (image/png)    


[image2023-4-26_19-12-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YTg4IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.4s-S5lKFS5mmCFhm1R8__9aBJmRhBinwJDSAdCpsFCk)

 (image/png)    


[image2023-4-26_19-10-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YTg5IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.0zPHAaEvTJBK3YVC2iioExGRBNqGphIjS1dS9FAUEio)

 (image/png)    


[image2023-4-26_18-49-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzEzIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.vVTpFYS6ZcVvIf6YnGwRfSHCH1eJ-waOoBh-JhNqGVQ)

 (image/png)    


[image2023-4-26_18-35-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzE0IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.RwedSPpPr9pMyls5DtjP0MKtmxBeVgrzrtYF9ufhSOA)

 (image/png)    


[image2023-4-26_17-45-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YThiIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.hqUXxU9AJJADAZunefwTov96LEoniqsFt0Zd5jKrzCc)

 (image/png)    


[image2023-5-17_11-9-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzE2IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.FAVqwfJ4ywkrCtvTLRjbVOv1EZM5aEdsbCwMN2fsdPM)

 (image/png)    


[image2023-5-17_11-10-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWI4OTcwYzJhZjRmNTFmYzE4IiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.JvgTuK0nsF9yGl-At1UL5zGRtHvIfC8Yux2uHNiJOCI)

 (image/png)    


[image2023-5-17_11-18-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWJhMWFkOWEzMzExZGM3YThjIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.u1hFO5YFPvbPPLUGe5S7ThsN-N8V9HyKQA7og3-17oo)

 (image/png)    


[image2023-5-17_11-21-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YThkIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.eKgr3TOT3Qd84ow91iJZ734y4f6_vcYV_oh5tD5LR84)

 (image/png)    


[image2023-5-17_11-24-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YThlIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.JaG_ay9TnmmvrvJlrPB0OqJaqIkw38r6SqEgmGuNh0Q)

 (image/png)    


[image2023-5-17_17-13-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YTkwIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.dI5FGkTxYSSfJWh_wglRH7URadh7yWsJxdrUu42eM30)

 (image/png)    


[image2023-5-17_17-49-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YTkxIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.83FRfT3bvbuPwZbh9cV8i5NdZB6NoPspf95bjbFWsMc)

 (image/png)    


[image2023-5-17_17-55-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWM4OTcwYzJhZjRmNTFmYzFjIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.gnjfDrtDWceDpsuUsfNFO60_Jbh9cIiM3X8Pp6uIo5o)

 (image/png)    


[image2023-5-18_9-11-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YTkyIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.uCyLpIrWIoSyoX8Ky99ZN1zi-O5BYlFe7IGyUCOnVpE)

 (image/png)    


[image2023-5-18_9-38-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWM4OTcwYzJhZjRmNTFmYzFkIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.HeXdpbVlnHN1CbBcF4KNtGyIcCQ2LB7xPvQKayQ0Y-Q)

 (image/png)    


[image2023-5-18_9-41-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWNhMWFkOWEzMzExZGM3YTkzIiwicmVmX2lkIjoiNjczOTZhMWE1OTNmOTljOWZmMjM1NWVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDAxLCJleHAiOjE3ODIyOTc4MDF9.tBimUJeiWK1nJu0jvdJ-eMOIbM0J8wVD9WicAy9uNPQ)

 (image/png)    
