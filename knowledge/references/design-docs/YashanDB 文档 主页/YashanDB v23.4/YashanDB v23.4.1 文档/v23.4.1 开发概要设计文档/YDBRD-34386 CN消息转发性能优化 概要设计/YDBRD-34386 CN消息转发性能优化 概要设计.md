*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/667e57ce5d57e18ea9d3cbe7](https://pingcode.yasdb.com/ship/ideas/667e57ce5d57e18ea9d3cbe7)  *?  
#YASHAN-2949 CN消息转发性能优化
*

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/67107376e489dd0868f8e14e](https://pingcode.yasdb.com/pjm/items/67107376e489dd0868f8e14e)  *?  
#YDBRD-34386 CN消息转发性能优化*



##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#1-%E6%80%BB%E8%BF%B0)  

根据性能分析  [Spark 导入性能分析优化](https://conf.yasdb.com/pages/viewpage.action?pageId=156123577)  ，在分布式架构下，CN节点接收到客户端请求时，需要对请求包进行反序列化后，依据数据分区进行分组，再重新序列化后进行分发。

在大宽表场景下，CN的反序列化和序列化开销占比尤为明显，如100列的表，批量insert场景下，CN服务反序列化和序列化开销占比达到50%以上。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67496a8da1ad9a3311de3a88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUNBQkFnQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUJJSUFBQUFBQUFBQUFBQUFBUUFBQ0FFQUFBQUFBQUFJQUFDQUFBQUJBQVFBQUFBQUFBQkFBQUFBQUFRQUJBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJnQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4NjcsImV4cCI6MTc4MjQ2NzY2N30.2Dtq2aP_6UEVr31Lcoiyk2P5yjR15K5RvFLrE6EBZ3E)

最新版本火焰图：

![WXWorkLocalPro_17334732865250.png](https://pingcode.yasdb.com/atlas/files/public/6752b432a1ad9a3311de435e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUNBQkFnQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUJJSUFBQUFBQUFBQUFBQUFBUUFBQ0FFQUFBQUFBQUFJQUFDQUFBQUJBQVFBQUFBQUFBQkFBQUFBQUFRQUJBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJnQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4NjcsImV4cCI6MTc4MjQ2NzY2N30.2Dtq2aP_6UEVr31Lcoiyk2P5yjR15K5RvFLrE6EBZ3E)

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

嘉实基金POC期间  [Spark 导入性能分析优化](https://conf.yasdb.com/pages/viewpage.action?pageId=156123577)  分析发现，CN消息转发时，需要经过反序列化和序列化，对DML性能影响较大，需要优化提升性能。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [Spark导入方案讨论](https://conf.yasdb.com/pages/viewpage.action?pageId=156131558)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|性能|batcherror的批量insert场景性能优化，100列大宽表批量insert场景性能提升15%~20%|  
|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

不涉及

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#2-%E6%8E%A5%E5%8F%A3)  

无新增接口和变更接口。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

|规格/约束|内容|原理|备注|
|---|---|---|---|
|规格|只支持在开启batcherror情况下的批量insert场景有优化效果|只支持在开启batcherror情况下的批量insert场景有优化效果|  
|


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#4-%E7%89%B9%E6%80%A7)  

参考Driver的CS通信协议：  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673975cf728206efb92f6326](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673975cf728206efb92f6326)  

  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673975d6593f99c9ff23c021](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673975d6593f99c9ff23c021)  



CS的reqExecute消息：

|stmtId(16)||flag(8)|unused(8)|
|:---:|---|:---:|:---:|
|paramCount(16)||paramSize(16)||
|prefetch(32)||||
|paramTypeDesc(0 ..   paramCount)||||
|params  (0 .. paramSize)||||


**stmtId**  :  statment 标识符

**flag**  : 执行标志

   0x01  autoCommit

   0x02  可以接受中间结果

   0x04 返回Batch DML Row；否则返回Batch Total AffectedRow。

   0x08 支持返回BatchError, 并忽略Batch中的错误继续执行；否则遇到错误直接中断执行，并返回错误。

**paramCount: **  绑定参数的个数

**paramSize**  : 绑定参数的  batch  数量(batch execute时), 最大为65535 

**prefetch**  ** **  : 预取结果集数量，0表示使用服务端参数(默认为10)



**paramTypeDesc**  : 绑定参数类型描述，包括bindType和direction, paramCount表示共有paramCount个参数类型描述

|  ParamTypeDesc||
|:---:|---|
|bindType(8）|direction（8）|


**bindType**  :绑定参数类型

**direction**  :绑定参数方向，IN/OUT/INOUT



**params**  :绑定参数的具体内容，包括绑定参数的长度和数据，paramSize表示共有paramSize行绑定参数

|len(8）|longLen（16）|data|
|:---:|:---:|:---:|


**len**  : 

  0xFF:  null value，没有longLen和data。

  0xFD:  使用longLen表示长度

  <0xFD: len表示实际长度，longlen字段省略

**longlen**  : len为0xFD时，表示data长度

**data**  ： 内容



**CN/DN间batchError批量消息协议中的数据部分：**

|index(16)|type(8)|isNull(8)|len(32)|data|
|:---:|---|:---:|:---:|---|


**index**  : 该绑定参数在原始绑定参数批次中的第几个参数

**type**  : 该绑定参数的类型

**isNull**  : 该绑定参数是否为null

**len**  : 该绑定参数的长度

**data**  ： 内容



#### 4.1 优化思路



![WXWorkLocalPro_1733472165601.png](https://pingcode.yasdb.com/atlas/files/public/6752b000a1ad9a3311de4355/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUNBQkFnQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUJJSUFBQUFBQUFBQUFBQUFBUUFBQ0FFQUFBQUFBQUFJQUFDQUFBQUJBQVFBQUFBQUFBQkFBQUFBQUFRQUJBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJnQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4NjcsImV4cCI6MTc4MjQ2NzY2N30.2Dtq2aP_6UEVr31Lcoiyk2P5yjR15K5RvFLrE6EBZ3E)

CN消息转发流程如上图，由于CN需要根据参数按分区进行分发，因此必须逐行读取全量的绑定参数；而消息转发的最小单位是行，因此对分发的消息包组包时也是需要按行进行组包。基于该特点，考虑优化方案：

方案一：CN/DN间交互协议与CS交互协议保持一致，按行拷贝

参考CS通信协议，对CN/DN间的参数传输协议进行改造，使得CN可以直接将绑定参数按行进行缓存、分组以及重组包进行分发。这样可以将分发重组消息包时的按列逐个写入的过程优化成按行的内存拷贝，列数越多的表收益越明显。

该方案下面临的几个问题：

1，Driver与CN之间通过CS通道进行通信，而CN/DN集群内采用ICS通道进行通信，在集群内引入CS通信接口框架，会破坏原始架构原则，同时改造工作量大。

2，需要额外的内存缓存每一行的完整数据，同时如果存在跨包的行数据，则该方案不适用。

3，Driver与CN/DN间的字节序可能存在差异，因此异构组网场景下，该方案不适用。



方案二：定长数据连续存储，批量拷贝

1，对于定长的数据考虑一次分配连续内存，避免逐列分配内存，减少内存分配的调用次数；

如SplitOneRowData方法中按列逐个申请内存：

![WXWorkLocalPro_17334761502799.png](https://pingcode.yasdb.com/atlas/files/public/6752bf50a1ad9a3311de436e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUNBQkFnQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUJJSUFBQUFBQUFBQUFBQUFBUUFBQ0FFQUFBQUFBQUFJQUFDQUFBQUJBQVFBQUFBQUFBQkFBQUFBQUFRQUJBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJnQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4NjcsImV4cCI6MTc4MjQ2NzY2N30.2Dtq2aP_6UEVr31Lcoiyk2P5yjR15K5RvFLrE6EBZ3E)

2，对于需要发送的定长数据采用连续内存存储，在参数分区分组过程中，提前写入连续内存，则在重组消息包时，可以按行级别进行拷贝，避免按列逐个写入。

如：anlWriteBatchErrorParams按列逐个写入绑定参数的type，isNull标识等：

![WXWorkLocalPro_17334759806520.png](https://pingcode.yasdb.com/atlas/files/public/6752bed2a1ad9a3311de436d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUNBQkFnQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUJJSUFBQUFBQUFBQUFBQUFBUUFBQ0FFQUFBQUFBQUFJQUFDQUFBQUJBQVFBQUFBQUFBQkFBQUFBQUFRQUJBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUJnQUFBQWdBQUFBRUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4NjcsImV4cCI6MTc4MjQ2NzY2N30.2Dtq2aP_6UEVr31Lcoiyk2P5yjR15K5RvFLrE6EBZ3E)

|方案|优点|缺点|
|---|---|---|
|CN/DN间交互协议与CS交互协议保持一致，按行拷贝|对于行数据非跨包场景，性能更优|1，需要在CN/DN集群间通信引入CS通信接口框架，会破坏原始架构原则，同时改造工作量大。,2，需要额外的内存缓存每一行的完整数据,3，如果存在跨包的行数据，则该方案不适用。,4，Driver与CN/DN异构组网场景下，该方案不适用|
|定长数据连续存储，批量拷贝|1，对协议改造小，风险可控；,2，不需要额外内存缓存整行数据,3，具备通用性，包括行数据跨包的场景|对于绑定参数值仍然需要逐个列写入，性能非最优|




**综上分析，建议采用方案二。**



##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

- 支持Arrow列传输协议，提升读写的传输性能


## 













