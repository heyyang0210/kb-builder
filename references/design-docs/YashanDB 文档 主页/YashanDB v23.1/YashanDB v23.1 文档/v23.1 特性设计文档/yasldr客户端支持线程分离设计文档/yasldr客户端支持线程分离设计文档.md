Created by 贺国锋, last modified on 八月 14, 2023

需求链接：    [YDBRD-17263](https://jira.yasdb.com/browse/YDBRD-17263)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#1-overview%E6%A6%82%E8%BF%B0)  

lsc表在bulkload模式下，多线程并行，对配置的要求较高，如参数SCOL_DATA_BUFFER_SIZE, COLUMNAR_VM_BUFFER_SIZE等。可能报错：YAS-04438 parallel server error: failed to alloc 66112 bytes。

在DOP参数的设置下，yasldr客户端在导入过程中的会产生DOP数目的线程数，典型配置下，若DOP为32，DECODER_THREAD_TIMES为7，则会产生24个DOCDER线程。

每一个DECODER线程会产生一组到服务端的连接，连接数过多会导致服务端线程数过多，从而资源不足报错。

因此需要将DECODER线程和连接解耦，使得DECODER线程可以服用连接，降低服务端线程数。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

(1)增加CONN_POOL_SIZE参数

表示客户端DECODER线程可以共享的连接池数目

(2)增加CSV_BUFFER_SIZE参数

表示客户端YASLDR每次分配申请的BUFFER大小

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#3-interfaces%E6%8E%A5%E5%8F%A3)  

static   CodVoid    yasLdrAcquireConnEnv  (  YasLdrConnPool  * connPool,   YasLdrEnv  ** returnEnv)；  请求空闲连接

static   CodVoid   yasLdrReleaseConnEnv  (  YasLdrEnv  * env) ;                                    释放连接

static   CodVoid   yasLdrWaitEnvAvailable  (  YasLdrEnv   *ldrEnv);                               LOB场景下等待连接空闲可用

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

**从设计、架构、功能内部耦合角度产生的约束，必须给出详细说明，用于支撑测试方案的灰盒测试。**

**结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#51-architecture%E6%9E%B6%E6%9E%84)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

####   [5.2.2 客户端流程](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#522-%E5%AE%A2%E6%88%B7%E7%AB%AF%E6%B5%81%E7%A8%8B)  

前置条件：客户端是天然的线程分离，通过组织数据发送到服务端进行insert。当前对于客户端的修改主要在于减少与服务端建立的连接数。（下面描述中的decoder线程指客户端原有的binder线程）

（1）客户端增加CONN_POOL_SIZE参数，取值范围[1,32]，默认值为5

reader线程逻辑不变，decoder线程基本逻辑不变，只将建立连接移到主线程去做。

需要建立的连接数目受客户端参数CONN_POOL_SIZE控制，取值范围[1,32]，默认值为5，即创建5组连接供binder使用。

在用户设置CONN_POOL_SIZE值的情况下，该值以用户设置为准，否则该值和DOP相关联，具体为：若DOP大于30，则该值为15；若DOP大于10，则该值为10；否则该值为5。

这里的连接是组的概念，对于单机来说就是个，对于分布式来说，binder持有的一组连接表示这个binder持有了连接到CN和主DN上的连接。

binder线程的数量代表了建立连接的组数，由主线程建立，binder线程加锁使用。

遍历loader上的conn组，判断每一个连接的状态，若该连接未被使用，则占用该连接；否则继续查找；如果找不到可用连接，则等待。数据发送完毕后，需要设置连接状态为可用。

需要将数据条数的统计信息更改为按链接统计，而不是之前的按binder统计，若当前连接上数据条数已经达到提交水平，则进行一次提交。

（2）客户端增加CSV_BUFFER_SIZE参数，单位为MB，取值范围 [2,32]，表示客户端YASLDR每次分配申请的BUFFER大小

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#54-dfx%E8%AE%BE%E8%AE%A1)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,线程分离特性会将binder的专用连接改成从连接池获取，因此会对特性    [YDBRD-13228](https://jira.yasdb.com/browse/YDBRD-13228)    中commit的统计信息产生影响，因此需要变更。,变更后，commit信息中的线程信息变为连接信息,Posted by heguofeng at 八月 15, 2023 09:35|
|---|
