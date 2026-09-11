Created by 贺国锋, last modified on 一月 10, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#1-%E6%80%BB%E8%BF%B0)  

SR链接：      [YDBRD-22267](https://jira.yasdb.com/browse/YDBRD-22267)      [YDBRD-22298](https://jira.yasdb.com/browse/YDBRD-22298)  

yasldr需要支持在分布式场景下导入单个DN节点性能 200MB/s。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  
  在分区表场景下，随着分区数量的上升，yasldr导入性能急剧恶化。由于分布式默认采用分区表实现，因此在分布式场景下，导入性能恶化的现象尤其显著，因此需要针对分区表导入进行性能提升。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

NA

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

经过分析，分区表导入性能慢的原因是，yasldr在调用C驱动的接口发送数据时，发送的一批数据中包含了多个分区的数据，而在驱动层会针对每个分区的数据进行单独组包。

这样就会导致在分区数量上升时，这批数据将会被拆分为更多个小包发送，导致性能恶化降低。

可以通过提前将数据按照分区进行组织，在调用C驱动的接口发送数据时，提供的就是一个分区的数据，避免拆分为小包发送。

###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|**术语**|**描述**|**借鉴业界**|**参考**|
|:---|:---|:---|:---|
|controller|主线程， 作为控制线程，负责命令行参数解析效验、load data语法解析效验、csv文件切分、reader和sender线程组创建和管理|否|不涉及|
|reader|reader线程，负责csv文件的读取、逐行解码、分区计算，将数据转换为行结构挂载到分区数据的行链表上|否|不涉及|
|sender|sender线程，负责分区数据的行列转换，数据发送，以及服务端返回的错误消息处理|否|不涉及|


  [  
1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#2-%E6%8E%A5%E5%8F%A3)  

|**接口**|**接口表现**|**接口说明**|
|:---|:---|:---|
|命令行参数|CSV_CHUNK_SIZE|用来控制文件划分的Chunk大小，即待导入的数据文件按照CSV_CHUNK_SIZE切分后提供给reader线程读取，默认128MB，取值范围[16M-1024M]，单位为MB|
|命令行参数|SENDERS|控制发送线程的数量。默认情况下，发送线程数量为ROUND(DOP，DECODER_THREAD_TIMES + 1)，取值范围[1,128]。若设置了SENDER_COUNT，则以设置值为准，若超过DOP，则报错。|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、不同的部署模型和不同的分区数量，在最优性能的参数选择上可能不同，具体的参数选择设置需要进行实测。

2、目前针对每一个分区都创建4个分区slot的方式，因此在分区数量过大的情况下，可能导致资源不足。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#4-%E7%89%B9%E6%80%A7)  

总体上，如数据字典中所列，从功能上将线程划分为三类，即controller、reader和sender。controller作为主线程，在执行yasldr命令时即创建启动，三组线程之间的执行关系如图1所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396c31a1ad9a3311dc8857/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

图1 线程关系图

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    controller线程

controller线程作用在前面数据字典部分已经描述，此处不再赘述。controller线程的主要执行流程如图2所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396c318970c2af4f5209e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

图2 controller线程主要执行流程

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    reader线程

reader线程的作用在前面数据字典部分已经描述，此处不再赘述，reader线程的执行流程如图3所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396c31a1ad9a3311dc8858/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

图3  reader线程主要执行流程

### 4.3 sender线程

sender线程的作用在前面数据字典部分已经描述，此处不再赘述，sender线程的执行流程如图4所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396c318970c2af4f5209ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

图4 sender线程执行流程

sender线程10微秒轮询一次发送队列。

### 4.4 数据结构

![](https://pingcode.yasdb.com/atlas/files/public/67396c318970c2af4f5209eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

特性的目的是实现导入性能的提升，在可维可测方面，优化了定位性能问题的统计信息，更清晰的展示各个阶段的性能数据。

统计信息分为controoler的统计信息、READER统计信息、SENDER统计信息，在分布式情况下，还增加针对每个节点的发送统计。

controller部分展示reader和sender线程的数量、解析和准备执行环境的耗时。

reader部分展示io次数、io耗时、解码的行数、行最大长度、行平均长度、获取一行数据的耗时、解码耗时、分区计算耗时、转为行结构耗时、等待分区可用耗时、送入发送队列耗时以及线程总体的运行耗时。

sender部分展示发送次数、发送耗时、单次最大发送耗时、线程执行提交的次数、提交的耗时、从发送队列获取数据的耗时、行列转换的耗时以及线程总体的耗时。

节点部分展示发送到该节点的行数、发送的次数、发送耗时、单次最大发送耗时、提交的次数、提交耗时已经节点的地址信息。

增加节点部分的展示，可以有效定位在分布式场景下，某个节点短板导致导入变慢的问题。

更新后的统计信息示例如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c318970c2af4f5209ec/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

![](https://pingcode.yasdb.com/atlas/files/public/67396c318970c2af4f5209ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

![](https://pingcode.yasdb.com/atlas/files/public/67396c31a1ad9a3311dc885d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQVFBQUFBQUFBQUVFRW9BQkFBTUFBQUFBQUFBRkFBQUFBQUFBQVFBQUFBQUFDQXdBQUFBQUFLQUFBQUNBQVFRQUFBQUFBQUEwQUFBQUFBQUFCQUFBQkFBQUFBZ0FBQUFBQ0FBZ0FBQUFBQUFBQUpBQUFBQUFBQUFBQUJBQUFBQUFBQUJBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUpBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2MjEsImV4cCI6MTc4MjMxMDQyMX0.OkP4Ear9pFSIHy577Ko4f_EVwFmYsvJCFtCJEdn6VsI)

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

不涉及

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

 不涉及

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1、集中式非分区表测试

2、集中式分区表测试

3、分布式分区表测试

4、CSV_CHUNK_SIZE参数解析测试

5.、SENDERS参数解析测试

6、统计信息测试

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

6.1 增加CSV_CHUNK_SIZE参数说明

6.2 增加SENDERS参数说明

6.3 修改统计信息示例信息

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141567679#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1、分区计算采用从原始数据计算的方式，但此时数据已经进行过二进制解码，因此可以采用解码后的数据进行分区计算，提升分区计算性能

2、在发送线程发送数据时，行列转换的耗时占比接近一半，后续配合驱动层动态绑定，去除行列转换，降低性能损耗。

## Attachments:

 (application/octet-stream)    


[当前存在问题.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmY4OTcwYzJhZjRmNTIwOWQ2IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.2Z8dzmNebrrhFwU_6EIZpoRn1aoYA3A41OmpPtEJbvs)

 (image/jpeg)    


[当前发送执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmZhMWFkOWEzMzExZGM4ODQ0IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.dDdazFaWm8IwAt_u_G25OnFzGb_K6qh8B8cPI3iB88E)

 (image/jpeg)    


[单机非分区表数据解析执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmZhMWFkOWEzMzExZGM4ODQ1IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.cbrKQnfIJdTl2Fo2XpKdd7cNznLOnhhSlmT6JOk25fQ)

 (image/jpeg)    


 (application/octet-stream)    


[单机非分区表数据解析执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmY4OTcwYzJhZjRmNTIwOWQ3IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.xHyfv6CVNs14-ZkpTeiD_I16i_SEebOP45T1tbMOflM)

 (image/jpeg)    


[单机非分区表数据解析执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmZhMWFkOWEzMzExZGM4ODQ2IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.SQLqrfn_ODoOOtdsh-OJRg8BSRyHcxsnu0beFlOARKw)

 (image/jpeg)    


[单机分区表数据解析执行流程.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzA4OTcwYzJhZjRmNTIwOWQ5IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.izwfWXBbW88Z2vGFMnBsn0W9T3qiSHuCNl2qcKi8t1Y)

 (image/jpeg)    


[512KB内存结构.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzBhMWFkOWEzMzExZGM4ODQ4IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.M3BWPcxTuqXo4U6BNy0oXGE67NBJdSW19ey5egmsvjQ)

 (image/jpeg)    


[image2024-1-4_15-0-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzA4OTcwYzJhZjRmNTIwOWRiIiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.E8lnnLPBx8HpgoQql5dPeQ3gFVz9JvUDPjGF4kTAHvo)

 (image/png)    


[image2024-1-4_16-46-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzBhMWFkOWEzMzExZGM4ODRhIiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.8jhyJZxNKSUSqqCdR9nlST8G838KScuul4OINfzvUns)

 (image/png)    


[image2024-1-5_9-20-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzA4OTcwYzJhZjRmNTIwOWRjIiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.gZbamH9dTwxbeXDA_C10gYbk4Pa7x_FhX2gtIEutTe4)

 (image/png)    


[image2024-1-5_9-21-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzBhMWFkOWEzMzExZGM4ODRkIiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.FirmLw-oFuN7AFpEZlVnuBXjVXQmMFIXo7olraBmi-4)

 (image/png)    


[image2024-1-5_11-16-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzBhMWFkOWEzMzExZGM4ODU1IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.KErXGIyc_fTywZX8PpvsxmmybKdUNQvpuSO4D-0ienY)

 (image/png)    


[image2024-1-5_11-17-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzBhMWFkOWEzMzExZGM4ODU2IiwicmVmX2lkIjoiNjczOTZjMmY1OTNmOTljOWZmMjM2YjlkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjIxLCJleHAiOjE3ODIzODYwMjF9.npPwILDgeAzjmvIoOW4LpzG_B_i6zEigfpg_6HkZB2w)

 (image/png)    


## Comments:

|  [](null)  ,10月19日会议纪要：,1、改进协议，在yasldr层面组包，链路全双工，流式发送，独立线程处理服务端返回的错误消息,2、内存可控，针对分区建立内存池，可以指定发送的分区数量。,3、文件不落地,Posted by heguofeng at 十月 19, 2023 14:11|
|---|
|  [](null)  ,11月9日讨论纪要,当前存在的以下问题要改掉：    
  1、BatchExecute要有独立的应答报文    
  2、serverOutput改掉,  
,后续优化点：    
  1、分区量特别大，数据特别散，怎么做    
  1） 内存淘汰，发送数据量最多的    
  2） 分区合并，服务端自己拆分    
  3） 分区数据客户端自己积压到一定量之后再次拆分     
  2、PB级别的数据怎么导，需要后续继续考虑    
  3、LOB的优化可以先做,当前整体实现步骤：    
  1、LOB STREAM发送：32K以下直接填充，32k-2G 走流， 2G以上单独处理    
  2、按行绑定    
  3、分区数据链表管理,Posted by heguofeng at 十一月 09, 2023 11:46|
|  [](null)  ,会议纪要：,与会人：杨德柳、冯皓博、范瑜、陈钦卿、方少奎、贺国锋,会议时间：2024-01-05 14:30 - 15:30,会议纪要：,1、需要确认CONN_POOL_SIZE参数变更后SENDER_COUNT参数后的兼容性问题,2、需要给出READER和SENDER线程的计算公式 ,3、关于导入时各种参数的最优配置，后续需要考虑给出通用的计算公式，比如DOP、CSV_CHUNK_SIZE、SENDER_COUNT等如何配置时性能最优。,4、需要给出执行导入过程中所需资源的计算公式。       ,5、分区数上万时的内存淘汰,Posted by heguofeng at 一月 05, 2024 15:43|
|  [](null)  ,2、补充READER和SENDER的计算公式：,threadCount   =   MIN  (ldrGetUint32Option(  LOP_DOP  ),   maxThreadNum  );,senderCount   = IF用户设置：ldrGetUint32Param(  LDR_SENDER_COUNT  )  否则：   ANS_ROUND  (  threadCount  ,   decoderTimes   +   1  );,readerCount   =   MIN  (loader->  sliceCtx  .  sliceCnt  ,   threadCount   -   senderCount  );,4、补充资源消耗计算公式：,大体上的资源消耗计算公式为： reader_count * 8M + part_count * 4 * (batch_size * (max_line_size * 2 + 8 + 24 + 8 + col_count*32)),Posted by heguofeng at 一月 05, 2024 17:10|
