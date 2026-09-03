Created by 王泽凯, last modified on 七月 04, 2023

# **适用场景：IR/SR特性的详细设计文档**

**注：成熟模块的特性**  建议概要设计和详细设计可合一，所以特性设计文档中描述的要素需全面。

**       关键特性**  需要有IR层级的概要设计和SR层级的详细设计，此文档主要关心SR层级的详细设计，IR概要设计文档已承载的功能拆分和架构说明可不赘述，通过链接说明。

*---------------以下为正文开始分隔线-----------------*

#   [YDBRD-XXXX : XXX Design（XXX方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：YDBRD-XXXX / SR链接：YDBRD-XXXX

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#1-overview%E6%A6%82%E8%BF%B0)  

本设计文档用来设计所有scan算子的cost算法

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=95096761#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### **2.1 TABLE SCAN COST 算法设计**

  Table full scan cost算法

总体公式如下：

[table_full_scan.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWRhMWFkOWEzMzExZGM3YTllIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.JQ2q3b5Vd-BMctRE8jg1eCUhRq3SrsPEH_2gbfcOdA8)

![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

公式解析：

Table Full scan一共有两大需要考虑的模块：CPU + IO

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|CPU    
    
    
|Read    
    
|每一条rows从buffer pool里fetch出来所需要的cost,包含：,1. 准备cursor等资源的cost
1. 实际从buffer pool中拿一条rows上来的cost    
  （buffer pool copy 至 vm buffer）
|  
|Rows对应指令数：,- 对于cpu read的cost来说，比较难确定的就是row对应的指令数。（测试发现并不是线性关系，需要剖析代码来分析）
|
||Filter|每一条rows从buffer pool里fetch出来后经过filter的cost,包含：,1. expr执行cost
    1. expr_column解码
    1. expr运算
1. filter执行cost
    1. and、or filter cost（可认为几乎为0）
    1. 其余filter运算
|- 在fetch blocks后，会把一行rows挂在cursor的rows指针上。
- 之后调用ankexecfilter，对filter内涉及到的rows col进行抽出并进行计算。
|Expr Cost：,- 包括了column的解码以及各种运算（varSub, varAdd, varMul, varDiv）
-     1. column的解码对应的指令数需要确定（全确定工作量有些大）
    1. expr各种运算（全确定工作量有些大）
        1. 加减乘除，取余（每一个就有7、8种cost）
        1. neg等

|
|||||测试方法：,- 对于expr和filter执行的cost，是较为繁琐的。目前大约确定的方法，通过代码白盒的方式，归类不同expr计算和filter计算成几种，然后对这几种cost进行测试。    

-     1. 可以用测试col = 1和col != 1比例的方式，测试出所有filter间的cost比例，expr同理。
    1. 然后再测试出col = 1和read rows的cost比例即可。

|
|IO,  
|IO times|需要读取的IO次数,包含：,1. extent预读次数
1. 单块读次数 - （换入换出 + 普通读）
|-|Extent数量：,- extent并不是恒定8块block，而是会扩充，因此需要根据底层存储的算法进行扩充。存储算法如下。    

- ![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7ab2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)
|
|||||换入换出次数：,- 由于buffer pool的状态非常不好确定。因此当前只假设buffer pool是全空的，然后用全部的block size去减，多余的除以换出的block size。从而得到需要换入换出的次数（溢出的block数乘以2）。
|
||1. IO latency cost
1. Blocks_IO_transfer_cost
|1. 每一次IO所耗费的寻址和延迟
1. 传输延迟耗费的cost
,  
|-|不同硬件的cost确定（后续需要支持工具进行测试）：,- ![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7ab3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)
- ![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)
-   [磁盘IOPS的计算 | 李小波 (xiaobo.li)](https://www.xiaobo.li/notes/archives/934)      [2022.6.15（磁盘调度算法） - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/529323242)  
-   [磁盘性能分析 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/59514527)      [吞吐量和 IOPS 及测试工具 FIO 使用 - hukey - 博客园 (cnblogs.com)](https://www.cnblogs.com/hukey/p/12714113.html)  
|


### **2.2 INDEX SCAN COST 算法设计**

  Index Cost总览

整体公式如下：

[index_scan_cost.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWQ4OTcwYzJhZjRmNTFmYzI4IiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.cAHApCofp97l_6ZVsi5VFF9SvnvDztJaSoglUYkMROo)

![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7ab6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7ab8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

目前index已知的stats：

![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

需要公共考虑的部分：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Search Times / Index_Key_Fecth_Rows|二分查找的比较次数(ASL) / 一共需要拿出来的index_key_rows|-|实际上 Search_Times 和 Index_Key_Fecth_Rows是近似相等的,1. 在一些细节上，可以近似忽略，比如在拿左指针的时候，其实没有实际fetch key rows。    
  这时候就不记入search times。
1. 一次的ASL，可以由这个公式确定：    [关于ASL(平均查找长度)的简单总结 - 回忆酿的甜 - 博客园 (cnblogs.com)](https://www.cnblogs.com/ygsworld/p/10238729.html)      
  ((n+1)log  2  (n+1))/n-1
|
||CPU_Each_Search_Cost|一次查找需要消耗的cost,包含：,1. compare的成本
|-|问题：,compare的成本需要如何测出来？|
||Fetch_One_Key_Row_cost|Fetch一条key row的cost,包含：,1. 从buffer里fetch出一条rows的成本
|-|问题：,key row fetch的成本和table scan fetch的成本是否一致？是否有区别。（需要看代码跟踪）,比例关系需要确定。|


#### 2.2.0 INDEX SCAN 回表 COST

  Index Scan Access Cost

对于回表的Cost来说，需要考虑的也仍然是IO和CPU这两大块。

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Access_Cost    
    
    
|Table_Block_IO_times|回表一共需要读的IO次数,包含：,1. 全部读需要涉及到的IO次数
|-|![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7ab9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)|
||Table_Blocks_size|全部blocks的大小|-|Table_Block_size = Table_Block_IO_Times * 8K （dft）|
||CPU_Read_Cost / ,CPU_Filter_Cost|读rows需要的Cost /,读rows时执行对应filter的cost|-|见table_scan_cost|


#### 2.2.1 INDEX UNIQUE SCAN COST

  Index Unique Scan Cost

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Index_Block_IO_times    
    
    
|每次Index Tree扫描下来的IO次数,包含：,1. 非叶子节点的IO次数
1. 叶子节点的IO次数
1. 根据缓存假设，可再减去相应IO数
|-|branch + leaf节点的IO次数：,- 由于是unique，因此节点IO次数 = level
|
||||-||
||||-|缓存需减去的IO次数 = ？（命中率）|
||Index_Blocks_Size|读到的全部Block的总大小,包含：,1. 非叶子节点的IO大小
1. 叶子节点的IO大小
|  
|Size = level * Index_Blocks_Size（8K）|
||Search_compare_times,(ASL)|一共的比较次数(ASL查找长度),包含：,1. 非叶子节点的比较次数（二分查找 or 单次查找）
1. 叶子节点的比较次数（二分查找 or 单次查找）
|  
|叶子节点比较次数= 叶子节点二分查找比较次数：,- times =   ((n+1)log  2  (n+1))/n-1 * 1
- n =（rows / leafBlocks）
,非叶子节点比较次数 = 非叶子节点二分查找次数：,- times =   ((n+1)log  2  (n+1))/n-1   * (level - 1)
- n ？
    - 约等于  （rows / leafBlocks）
    - 准确的话需要推到一下公式
|
||Index_Key_Rows|一共拿了多少key rows = 一共的比较次数,包含：,1. 非叶子节点的key rows
1. 叶子节点的key rows
|  
|Index_Key_Rows = Search_compare_times|


#### 2.2.2 INDEX RANGE SCAN COST

  Index Range Scan Cost

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Index_Block_IO_times    
    
    
|每次Index Tree扫描下来的IO次数,包含：,1. 非叶子节点的IO次数
1. 叶子节点的IO次数
1. 根据缓存假设，可再减去相应IO数
|-|branch + leaf节点的IO次数：,- 由于是range，会有多趟，趟数 = 多少个range
- Index_Block_IO_times = 趟数 * (level - 1) + index_selectivity * leafBlocks (selectivity细节还需要再考虑)
|
||||-||
||||-|缓存需减去的IO次数 = ？（命中率）|
||Index_Blocks_Size|读到的全部Block的总大小,包含：,1. 非叶子节点的IO大小
1. 叶子节点的IO大小
|  
|Size = Index_Block_IO_times * Index_Blocks_Size|
||Search_compare_times,(ASL)|一共的比较次数(ASL查找长度),包含：,1. 非叶子节点的比较次数（二分查找 or 单次查找）
1. 叶子节点的比较次数（二分查找 or 单次查找）
|  
|叶子节点比较次数= 叶子节点二分查找比较次数：,- times =   ((n+1)log  2  (n+1))/n-1   * index_selectivity * leafBlocks (selectivity细节还需要再考虑)
- n =（rows / leafBlocks）
,非叶子节点比较次数 = 非叶子节点二分查找次数：,- times =   ((n+1)log  2  (n+1))/n-1   * range数 * (level - 1)
- n ？
    - 约等于  （rows / leafBlocks）
|
||Index_Key_Rows|一共拿了多少key rows = 一共的比较次数,包含：,1. 非叶子节点的key rows
1. 叶子节点的key rows
|  
|Index_Key_Rows = Search_compare_times +    index_selectivity * leafBlocks * rows each block|


#### 2.2.3 INDEX FULL SCAN COST

  Index Full Scan Cost

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Index_Block_IO_times    
    
    
|每次Index Tree扫描下来的IO次数,包含：,1. 非叶子节点的IO次数
1. 叶子节点的IO次数
1. 根据缓存假设，可再减去相应IO数
|-|branch + leaf节点的IO次数：,- 由于是full，只需要一路走到底，然后从左到右扫描
- Index_Block_IO_times = (level - 1) +leafBlocks
|
||||-||
||||-|缓存需减去的IO次数 = ？|
||Index_Blocks_Size|读到的全部Block的总大小,包含：,1. 非叶子节点的IO大小
1. 叶子节点的IO大小
|  
|Size = level * Index_Blocks_Size|
||Search_compare_times,(ASL)|一共的比较次数(ASL查找长度),包含：,1. 非叶子节点的比较次数（二分查找 or 单次查找）
1. 叶子节点的比较次数（二分查找 or 单次查找）
|  
|叶子节点查找次数 + 非叶子节点查找次数：,- times = level - 1
|
||Index_Key_Rows|一共拿了多少key rows = 一共的比较次数,包含：,1. 非叶子节点的key rows
1. 叶子节点的key rows
|  
|Index_Key_Rows = rows + (level -1)|


#### 2.2.4 INDEX FULL SCAN MIN MAX COST

直接用uniqueScan即可 (comp少一些)

select max(c1) from t1;

#### 2.2.5 INDEX RANGE SCAN MIN MAX COST

直接用uniqueScan即可 (comp多一些)

select max(c1) from t1 where c1 > 5 and c1 < 10;

#### 2.2.6 INDEX FAST FULL SCAN COST

  Index Fast Full Scan Cost

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Index_Block_IO_times    
    
    
|每次Index Tree扫描下来的IO次数,包含：,1. 非叶子节点的IO次数
1. 叶子节点的IO次数
1. 根据缓存假设，可再减去相应IO数
|-|branch + leaf节点的IO次数：,- 由于是fast full，每次都是预读上来一个extent
- Index_Block_IO_times 近似等于 用Blocks总数去匹配原来的extent分配算法（需要再确定index的block是否不会和heap混在一起？）
|
||||-||
||||-|缓存需减去的IO次数 = ？|
||Index_Blocks_Size|读到的全部Block的总大小,包含：,1. 非叶子节点的IO大小
1. 叶子节点的IO大小
|  
|Size = Blocks * Index_Blocks_Size|
||Search_compare_times,(ASL)|一共的比较次数(ASL查找长度),包含：,1. 非叶子节点的比较次数（二分查找 or 单次查找）
1. 叶子节点的比较次数（二分查找 or 单次查找）
|  
|叶子节点查找次数 + 非叶子节点查找次数：,- times = 0
|
||Index_Key_Rows|一共拿了多少key rows = 一共的比较次数,包含：,1. 非叶子节点的key rows
1. 叶子节点的key rows
|  
|Index_Key_Rows = rows|


#### 2.2.7 INDEX SKIP SCAN COST

  Index Full Scan Cost

需考虑因子如下：

|Cost考虑因素|详细因素|含义|代码内大体流程|需考虑细节|
|---|---|---|---|---|
|Index_Cost    
    
    
    
|Index_Block_IO_times    
    
    
|每次Index Tree扫描下来的IO次数,包含：,1. 非叶子节点的IO次数
1. 叶子节点的IO次数
1. 根据缓存假设，可再减去相应IO数
|-|branch + leaf节点的IO次数：,- 由于是skip，会有多趟，趟数 = skip列 distinct * range次数
- Index_Block_IO_times = 趟数 * (level - 1) + selectivity * leafBlocks (selectivity细节还需要再考虑)
|
||||-||
||||-|缓存需减去的IO次数 = ？|
||Index_Blocks_Size|读到的全部Block的总大小,包含：,1. 非叶子节点的IO大小
1. 叶子节点的IO大小
|  
|Size = Index_Block_IO_times * Index_Blocks_Size|
||Search_compare_times,(ASL)|一共的比较次数(ASL查找长度),包含：,1. 非叶子节点的比较次数（二分查找 or 单次查找）
1. 叶子节点的比较次数（二分查找 or 单次查找）
|  
|叶子节点比较次数= 叶子节点二分查找比较次数：,- times =   ((n+1)log  2  (n+1))/n-1   * selectivity * leafBlocks (selectivity细节还需要再考虑)
- n =（rows / leafBlocks）
,非叶子节点比较次数 = 非叶子节点二分查找次数：,- times =   ((n+1)log  2  (n+1))/n-1   *  趟数 * (level - 1)
- n   约等于  （rows / leafBlocks）
|
||Index_Key_Rows|一共拿了多少key rows = 一共的比较次数,包含：,1. 非叶子节点的key rows
1. 叶子节点的key rows
|  
|Index_Key_Rows = Search_compare_times|


#### 2.2.8 ROW ID SCAN COST

  Row Id Scan Cost

需考虑因子如下：

select * from t1 where rowid = 123456 or row;

range次数决定 IO times

index_Cost = 0  (one block)Access_cost

无需再找index，直接读即可，因此只需要当作是回表为一块的读。详见回表。

#### 2.2.8 INDEX SCAN COST （and、or）

后续需要考虑。

### **2.3 PART SCAN COST 算法设计**

#### partScan有历史遗留的缺陷，提供的统计信息是全表的而不是分区的，对于非ALL场景的基数估计影响很大。

目前先简单处理一下，对于统计信息，直接调存储的接口拿分区的block_count等。对于非ALL场景的选择率，根据所拿到的全表选择率做一个计算：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

#### 2.3.1 PART SINGLE SCAN COST

![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

#### 2.3.2 PART ALL SCAN COST

由于不知道动态剪枝能剪多少，暂时按ALL来算。

![](https://pingcode.yasdb.com/atlas/files/public/67396a1f8970c2af4f51fc43/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

#### 2.3.3 PART ITERATOR SCAN COST

注意扫多分区时，buffer_pool_size累加。

![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7aba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

### **2.4 并行scan COST 算法设计**

#### 2.4.1 TABLE FULL SCAN COST

#### 2.4.2 INDEX FAST FULL SCAN COST

![](https://pingcode.yasdb.com/atlas/files/public/67396a1fa1ad9a3311dc7abb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNDRUFBRUFFQUFBQUFBMEFBQUFBQ3dRQUFFQUFBQUFBQ0FnQUFBQUJBQWdBSUFBQUFBQUFrQUFBQkFLb2dBUUJBQVlBQUFBQUFBRUFDQkFBQ0JBQUFBQUNCQkFBQUFBQUFBRUlJQUFFSUVJQUFnQUFTQUFBUUFBQUFBSUFJZ0VBQUFBQUFBQUFJQUFFQUFBQUFBQ0FHQVFBQVFnQUFBQUFCQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0MjIsImV4cCI6MTc4MjIyMjIyMn0.bTRIYgxndosYH4buX2gOH5LXcfuPC9YAzMtv_IGcgM4)

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

[image2023-4-26_17-45-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWRhMWFkOWEzMzExZGM3YWEwIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.8mO83VUVbgZYrhc0XpraY2aLeyiY7h6SSvJirHCoaZ8)

 (image/png)    


[image2023-4-26_18-35-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWRhMWFkOWEzMzExZGM3YWExIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.Fu1zNwDByZhJl1k7SbsXvPPHvjy-1iFfvIOZzFHSVbY)

 (image/png)    


[image2023-4-26_19-16-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWQ4OTcwYzJhZjRmNTFmYzJlIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.K6fhY5heGCrf2zWx3QUH_pOdJRMNz0L0Gk91NCNJZAs)

 (image/png)    


[image2023-4-27_10-10-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWU4OTcwYzJhZjRmNTFmYzMzIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.FKIV_4DNwA6YWCdqX3-cwF8Q_UKWMzRMucEOSo20VFU)

 (image/png)    


[image2023-4-27_10-40-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWE4IiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.MSFdR7zU1ETmNP5biWmF5NURfNR64QNKNEh28xp3soc)

 (image/png)    


[image2023-4-27_10-55-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFhIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.ovzuVaWz_pV6NW3bTiQVWFIbWdkPjiwgStMywJS-shI)

 (image/png)    


[index_scan_cost.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWU4OTcwYzJhZjRmNTFmYzM0IiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.VrYc0ocg8czDG-Y1FzgRYxWkE_JrPm-_qwccxf1ZgFU)

 (application/octet-stream)    


[table_full_scan.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFiIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.j1GjZUgIA_wtPwbaIyIScoHyTKDXWPRodt8GhdM1InI)

 (application/octet-stream)    


[image2023-4-27_11-56-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFjIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.WAjHkrpzpAn-pNE9DSZR0vkYi-0owkizrM6wBMTNDlc)

 (image/png)    


[index_scan_cost.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWQ4OTcwYzJhZjRmNTFmYzI4IiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.cAHApCofp97l_6ZVsi5VFF9SvnvDztJaSoglUYkMROo)

 (application/octet-stream)    


[image2023-4-28_14-38-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFkIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.RDsrvRU5g0ZMtjdZ5kJ_CqHgbpb6_VGVjBLbMP91HBw)

 (image/png)    


[table_full_scan.wmf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWRhMWFkOWEzMzExZGM3YTllIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.JQ2q3b5Vd-BMctRE8jg1eCUhRq3SrsPEH_2gbfcOdA8)

 (application/octet-stream)    


[image2023-4-28_14-52-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWU4OTcwYzJhZjRmNTFmYzM5IiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.md5JjnDNtcMtSH9buyb4kXr9Pg1Vs3QfOrGPDmjTA0Q)

 (image/png)    


[image2023-4-28_15-36-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFlIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.eXWxzrS10oYUAPtpbuZf_DsbgKYDhTSsWinoO9IT6ME)

 (image/png)    


[image2023-4-28_15-38-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWU4OTcwYzJhZjRmNTFmYzNhIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.Eu4wD9501FkNjKkhZ8A278UewqMdhIhZ29iZTjUqUCo)

 (image/png)    


[image2023-4-28_15-46-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMWVhMWFkOWEzMzExZGM3YWFmIiwicmVmX2lkIjoiNjczOTZhMWQ1OTNmOTljOWZmMjM1NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNDIyLCJleHAiOjE3ODIyOTc4MjJ9.TKXmnKzqlxu-c5eM8vBF1Tnc2FehlnfvfFUx7InzPaE)

 (image/png)    
