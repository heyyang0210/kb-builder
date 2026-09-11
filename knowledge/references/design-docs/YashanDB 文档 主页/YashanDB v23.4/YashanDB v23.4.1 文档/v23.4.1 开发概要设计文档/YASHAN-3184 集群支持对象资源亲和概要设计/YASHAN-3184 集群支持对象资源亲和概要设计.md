Created by 孟凡彬, last modified on 十一月 15, 2024

概要设计：YASHAN-3184 集群支持对象资源亲和

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66cc7c1d4283cf23d4f3c3c6](https://pingcode.yasdb.com/ship/ideas/66cc7c1d4283cf23d4f3c3c6)    ?    


  


-   [1. 总体概述](#1-总体概述)  
    -   [1.1 需求背景](#11-需求背景)  
    -   [1.2 需求来源](#12-需求来源)  
    -   [1.3 调研文档](#13-调研文档)  
    -   [1.4 需求分析](#14-需求分析)  
    -   [1.5 数据字典](#15-数据字典)  
-   [2. 对外接口](#2-对外接口)  
-   [3. 规格与约束](#3-规格与约束)  
-   [4. 架构设计](#4-架构设计)  
    -   [4.1 功能设计](#41-功能设计)  
    -   [4.2 可靠性设计](#42-可靠性设计)  
    -   [4.3 主备集群设计](#43-主备集群设计)  
    -   [4.4 性能设计](#44-性能设计)  
    -   [4.5 可维可测设计](#45-可维可测设计)  
    -   [4.6 安全性设计](#46-安全性设计)  
    -   [4.7 兼容性设计](#47-兼容性设计)  
-   [5.需求分解](#5需求分解)  
-   [6.未来规划](#6未来规划)  


##   [1. 总体概述](#1-总体概述)  

###   [1.1 需求背景](#11-需求背景)  

当前需求被提上版本议程有两个触发事件：

- 集群与宏杉存储联合测试时，发现崖山集群在  **单会话、大数据量**  查询、插入等DML场景下  **性能表现非常差**  ，经分析单会话场景下存在大量的跨节点全局资源访问消息，对性能影响较大，原因是集群下的资源分布采用的是一致性哈希，导致即使是单会话访问仍然存在跨节点开销。
- 与招商证券交流，招证DBA反馈他们使用集群不完全是透明路由的方式，  **某些重点业务会绑定到特定实例上执行**  ，同时从相关SA处获悉，不止招证，很多厂商使用集群有一定的affinity特点。


###   [1.2 需求来源](#12-需求来源)  

当前需求最初来自两年前研发内部的共享集群架构规划，大部分用户使用集群时一般有两种策略：

- 第一种就是应用分区，用户按照业务系统进行集群下多实例的划分使用，某些重点业务会集中到特定的实例上，此时一般不会依赖集群的负载均衡能力。
- 第二种就是应用透明，用户不关心集群下的数据分布、缓存分布，对集群下跨节点数据交换带来的性能影响不敏感，一般采用完全对等透明方式使用。


基于这两种使用方式，集群下各实例的缓存呈现不同的特点，共享集群最初采用了完全对等透明的架构，对应用分区的业务场景的支持度需要增强。在23.2.X版本中引入了智能化的多实例并发刷盘技术，用以优化应用分区和应用透明场景下的刷盘问题。

从长期演进角度来看，亲和性需要通过一系列需求进行演进和完善。目前的总体规划如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef1a1ad9a3311dc9b04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

其中在23.3版本中正式启动了对象级缓冲区系列需求的设计，详细参考    [对象资源管理设计](https://conf.yasdb.com/pages/viewpage.action?pageId=156110813)    ，主要进行了对象级缓冲区管理的设计和原型验证。

从23.4版本开始，  **用户可以在集群中使用undo亲和性，在应用分区场景下，通过指定用户自定义对象资源亲和性，进行初步的体验。**   完整的、体系化的能力还需要后续的版本进行持续的演进。

###   [1.3 调研文档](#13-调研文档)  

业内支持共享形态的厂商有限，目前只有oracle RAC具备对象亲和性系列的能力，oracle经历了若干的版本进行演进，其发展历程是曲折的。

![](https://pingcode.yasdb.com/atlas/files/public/67396ef1a1ad9a3311dc9b05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

oracle RAC的发展路线以及经验教训：

1. 鉴于DRM的不可控性，慎重引入DRM的能力，需要进行充分的技术论证，以及进行完备的DFX设计。
1. 资源的在线迁移场景会对系统在线业务的有较大影响，可以考虑后续版本技术方案成熟后再启动。
1. 基于全局资源的访问统计可以给优化和执行提供必要的输入，让SQL感知资源的分布情况。


其他像GaussDB、达梦共享集群、金仓、优炫目前都没看到类似的能力。崖山支持集群亲和性后，  **会成为产品的一个重要的亮点特性**  ，在应用分区场景下会发挥比较大的价值，进一步增强产品的竞争力。

###   [1.4 需求分析](#14-需求分析)  

结合    [对象资源管理](https://conf.yasdb.com/pages/viewpage.action?pageId=156110813)    和    [undo亲和性](https://conf.yasdb.com/pages/viewpage.action?pageId=171057208)    两个前置需求的设计，当前需求所具备的基础能力已经具备：

1. 通过赋予缓冲区以对象属性，进而构建对象级全局缓存管理、全局资源管理的能力。
1. undo亲和性构建了对象亲和的基础，使得GRC、GCS具备了资源亲和管理能力。


当前特性需要重点围绕用户自定义对象维度，以及相关的场景进行设计。

|类别|子类|分析|结论|
|---|---|---|---|
|功能|\|具备数据段存储属性（segment store）的用户对象有表、索引、分区、lob，只有具备data object属性的对象才可以定义对象亲和属性。<br>然而其中部分对象存在关联关系，比如表和lob逻辑上而言是密不可分的。 <br> 从用户实际的应用分区视角来分析，表和相关的索引、lob应该具备相同的亲和属性。|功能层面从两个维度进行划分：表（包含对应的索引、lob）以及表分区（包含对应的索引分区、lob分区）。|
|DFX|可靠性|支持用户自定义对象亲和后，ORM能力会进一步补齐，需要综合考虑各类相关可靠性场景。|围绕在线故障、实例启停进行设计|
||可用性|对象资源亲和性在主备集群下需要适配，设计要考虑主备形态。|考虑备集群上ORM的动态维护、访问，备集群升主实例下的一致性、备集群实例在线故障对ORM的影响|
||性能|设置对象亲和属性后，亲和实例访问对象原则上性能有所提升，其他实例访问有所下降。|需要进行一定性能测试设计|
||安全性|当前特性属于表、表分区语法的扩展，权限受对应语法权限约束，  **不涉及其他安全相关**  。|不需要进行安全特性设计|
||易运维|通过系统表或V$GRC_AFFINITY_POLICY动态视图，查看对象亲和的最新状态以及迁移状态|如果支持在线迁移资源，需要视图考虑维护迁移状态|
||兼容性|新增了对象级系统表，对历史版本升级有影响|基于升级框架添加新系统表升级路径|


###   [1.5 数据字典](#15-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|对象亲和|描述|是|oracle RAC|
|undo亲和|描述|是|oracle RAC|


##   [2. 对外接口](#2-对外接口)  

用户通过新的SQL语法分支进行设置对象的亲和属性。

![](https://pingcode.yasdb.com/atlas/files/public/67396ef18970c2af4f521c93/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

![](https://pingcode.yasdb.com/atlas/files/public/67396ef1a1ad9a3311dc9b06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

这里设计可以不指定instance编号，主要是考虑用户从业务侧不一定可以方便的获取并管理连接对应的实例信息。因此考虑支持使用当前执行语句的实例为亲和实例。

![](https://pingcode.yasdb.com/atlas/files/public/67396ef18970c2af4f521c94/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

基于持久化的诉求，需要新增对应的系统表用以存储对象亲和属性。

##   [3. 规格与约束](#3-规格与约束)  

由于当前需求仍然是一系列需求中的一环，因此仍然引入一定的约束限制，同时本身对象亲和自带一定的规格：

1. 当前只支持指定表、表分区的亲和属性，其他对象不支持设置。
1. 当指定表亲和属性时，对应表下的索引、lob、分区默认跟随表的亲和属性。
1. 当指定表分区亲和属性时，对应分区的本地分区索引、lob分区默认跟随当前分区的亲和属性。
1. 只支持创建对象时指定亲和属性，暂不支持通过alter语法进行亲和属性的修改，主要原因是修改会触发在线资源迁移。
1. 表被truncate后，新的segment对象默认仍然保持原始亲和属性。
1. object affinity目前仅支持到全局缓存资源管理层面，全局缓存亲和在后续需求中支持，而全局锁资源亲和性通过本地锁特性支持。


##   [4. 架构设计](#4-架构设计)  

对象亲和性资源管理的重点在于设计一套基于对象的全局资源管理算法，并且可以对接到用户自定义对象。  **由于对象跟资源管理的联系由数据字典、缓存、全局资源关联**  ，整体设计也是围绕这几点展开。

1. 数据字典即系统表设计需要重点考虑系统表的力度应该是所有关联具备亲和属性的对象。
1. 支持对象级管理的本地缓存管理以及带有对象属性的全局缓存管理，关联数据字典、DC、缓存buffer、全局资源GRC。
1. 支持对象级资源管理算法，并对接用户自定义对象。


鉴于集群下设计的复杂性，需要以用户场景为目标（user case），在逻辑架构的基础上结合集群内部的并发处理、消息流特点进行设计分析。

**逻辑架构**

基于前面几个需求，对象级缓冲区管理以及对象级资源管理算法已经支持，对象亲和逻辑架构设计如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef1a1ad9a3311dc9b07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

- 在数据字典层面，新增对象亲和系统表进行亲和信息的持久化，对象亲和系统表在DC中没有独立的cache，可以考虑在对应对象cache中增加信息。
- 所有实例下对象亲和信息具备一致性，通过全局内存层中的GRC维护的OHT信息进行控制，OHT相当于对象亲和的cache信息。
- 对象资源亲和实际上是GRC资源的本实例化，仍然支持跨节点访问指定亲和属性的对象。


**场景分析**

从用户实际的使用场景分析，主要有两个层面，一个是亲和对象本身的操作，另外一个就是亲和对象所属环境、节点的变化。

![](https://pingcode.yasdb.com/atlas/files/public/67396ef18970c2af4f521c95/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

对象操作主要围绕亲和对象生命周期管理进行设计，对于关联对象的处理同样需要亲和性的维护。其中修改对象亲和属性属于当前版本未支持的范围。

对于对象亲和节点的变化分析同样至关重要，一个是主备集群角色，另外一个是节点状态的变化。

**实现分析**

对象亲和的两个最核心的设计就是系统表设计与OHT的设计，所有相关的场景全部围绕这两点展开，针对这两点进行结构化分析如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef1a1ad9a3311dc9b08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFFQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBaEJBQ0FBQUFJQUFBQUFBSUFBQUFBQUFBQ0FNSUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQ0FnQVFBQUFBQUFDQUVBQkFBQUFBQUFRQUVBb0JBQUFBQUFBQUFBQUFBQUFDQUFBUUFBQUJBQUFDQUFBQUFBQUFBQ0FBQUlBRUFJQUFoQUFCQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MjEsImV4cCI6MTc4MjQ2NzMyMX0.SC3v6B9yfRkcwNOLpqHwXh-66GN8mcY7rd5EmRsJ6vs)

###   [4.1 功能设计](#41-功能设计)  

基于结构化分析，功能层面的设计主要从下面几个维度：

####   [4.1.1 系统表设计](#411-系统表设计)  

系统表与对象属性强关联，因此系统表中必须要有oid列信息，不需要记录dataOid信息。

|功能场景|设计分析|关键点|
|---|---|---|
|系统表插入|create时进行系统表插入并跟随DDL进行事务提交|系统表需要记录oid，truncate会更新换dataOid，但oid不变|
|系统表更新|系统表的更新主要发生在对象master变更的场景，目前分析只有alter对象亲和属性才才会触发，当前需求不涉及。||
|系统表删除|系统表删除发生在  **对象真正被删除**  时，而非garbage真正清理对象时，与obj系统表保持一致|garbage的清理需要同步维OHT信息|


####   [4.1.2 OHT设计](#412-oht设计)  

OHT本质上属于GRC层面的对象亲和缓存，与dict entry具备类似的特点，其需要保证多节点下的一致性。

OHT与dict entry不同之处是，没有open的实例不需要加载dc entry以及dc entry相关的同步，对于OHT而言，只要实例加入集群，本节点的OHT原则上就需要为其他节点提供服务。

OHT管理的对象属于存储对象，以dataOid为单位，这里与系统表设计是不同的。

|功能场景|设计分析|关键点|
|---|---|---|
|OHT加载|OHT第一次加载由master实例启动到open阶段进行加载，不存在跨节点的GHT到OHT的资源迁移|由于主节点启动恢复过程中会访问资源，因此OHT加载可能存在  **主节点内部的GHT到OHT的资源迁移**  ，需要重点设计|
|OHT同步|非主实例启动加入集群，通过reform加入集群，在进行GHT master的同时进行OHT的同步，OHT的同步包含OHT的remaster以及OHT对象的资源迁移|非主节点加入集群不需要从系统表加载，此时主节点具备完备的OHT信息|
|OHT插入|OHT插入发生在DDL变更时，比如truncate会产生新的dataOid时会往OHT中插入新的object信息，OHT的难点在于多节点OHT的一致性，这里参考DC entry的并发控制|create对象，同步OHT会存在瞬时不一致性，不影响并发会话访问的正确性; <br> 对于truncate而言，只会插入新的object信息，旧的并不删除，因此同样不存在并发访问问题。 <br> OHT的插入还有一种属于undo对象的插入，其在master实例启动时维护|
|OHT更新|只有支持alter修改对象亲和属性语法时需要考虑OHT的动态更新场景，当前需求范围内不存在动态更新OHT master的场景||
|OHT删除|OHT管理的object删除发生在garbage清理对象或者回滚free segment，相关OHT对象已经不会被访问，可以直接清理多节点的OHT object||


####   [4.1.3 资源管理设计](#413-资源管理设计)  

资源管理包含三部分，资源访问、资源恢复、资源迁移。资源访问在UNDO亲和性需求中已经设计，用户自定义对象亲和不需要做调整。

对于资源恢复而言与普通的GHT资源恢复类似，经对应的相同的资源扫描、按照对应的算法进行恢复即可，在UNDO亲和性需求中已经实现。

资源迁移需要同步迁移resource、pastcopy、request等信息，从大的方案上来看存在以下多种选择方式：

|方案选型|方案一（RAC）|方案二（REDIS）|方案三|方案四|
|---|---|---|---|---|
|方案概述|RAC的GRD采用分128个partition锁的方式进行分阶段并行加锁迁移|迁移哈希槽通过标记状态方式的动态资源迁移|迁移过程中全程加GRC锁的静态方式迁移|迁移过程中免GRC锁的动态方式迁移，同步维护多份资源master信息|
|迁移场景|在线迁移，用户不可控|在线迁移，用户触发|reform阶段迁移，主节点启动迁移|reform阶段迁移，主节点启动迁移|
|系统影响|RAC早期没有做锁的partition，DRM导致的业务中断影响非常大|在线迁移，对业务影响小|本身reform加大锁，影响较小|本身reform加大锁，影响较小|
|性能影响|性能影响大|影响较小|影响较小|影响非常小|
|复杂性|较为复杂|非常复杂|简单|非常复杂，如果迁移状态下的资源维护出问题，会导致资源访问错乱|


在支持alter table修改对象亲和属性后可以选择在线迁移的方式，并结合RAC的grc latch partition化，进一步降低冲突，就当前需求支持的范围来看，优选方案三。

###   [4.2 可靠性设计](#42-可靠性设计)  

节点启停资源处理：

1. 节点启停remaster需要处理OHT对应master节点的问题。
1. OHT master节点停止，需要将节点管理的资源partition迁移到存活的节点，仍然以OHT的方式管理。
1. OHT master节点启动，需要将被其他实例托管的OHT资源迁移会本节点，仍然以OHT的方式管理。
1. 每个OHT object都具备独立的partition，迁移按标准partition迁移流程处理。


在线故障资源处理：

1. GHT到OHT迁移过程中只有主实例，实例故障后相当于集群重启。
1. 集群运行过程中发生故障，此时OHT按照托管进行管理，OHT管理的资源按照对应的资源分布策略进行重建。
1. OHT迁移过程中节点故障，GRC资源重新构建，按照新的托管策略进行资源重建。


在线故障OHT处理：

- 对于集群crash recovery而言，除了undo对象外，其他用户对象没有进行OHT加载，此阶段原则上不需要进行OHT的维护。 当其他实例加入集群后，这些实例同样不会触发crash recovery，这一点非常重要。对于crash recovery而言，我们定义原则允许在此阶段进行change buffer object。
- online recovery可以直接访问经remaster后全局一致的新的OHT，对于OHT而言需要进行一定的修正。这里和flush object不同，flush object直接处理即可，OHT的维护属于标准逻辑日志，需要按照逻辑日志的方式进行处理。另外online recovery是不走buffer接口的，因此不存在change object的问题。


###   [4.3 主备集群设计](#43-主备集群设计)  

热备回放需要同步维护OHT，因此此阶段外部查询可以接入集群进行对象访问，此时需要同步维护OHT的插入、删除、更新。 这类需要独立的逻辑日志，和flush object是完全两个独立的动作。

需要考虑备集群下多实例回放访问的一致性。对于加入OHT增加新对象而言，这类DDL只要回放时保证有并发回放即可。对删除OHT而言，保证前面所有实例都执行flush object即可。对于standby recovery而言，我们定义不允许在此阶段进行change object，否则会出现在线资源迁移。

###   [4.4 性能设计](#44-性能设计)  

当对象指定亲和节点为当前节点时，从实际业务特点分析，大部分的应用访问应该到亲和的节点上进行，此时访问对象的主节点就是本节点，可以减少跨节点的全局资源访问。对于大数据量访问的场景，比如大表查询、大表插入、更新等，缓存无法直接命中的场景下，可以大大提升访问的性能。

TPCC下存在不同仓的冲突，并且TPCC执行时选取仓是随机的，当前版本暂不支持动态修改亲和属性，对于TPCC而言指定了亲和节点反而可能会有影响。即使支持了动态修改亲和属性，因TPCC大部分数据属于热数据，此特性同样收益不会太明显。

因此此特性相关的性能场景需要针对性的设计以及测试。

###   [4.5 可维可测设计](#45-可维可测设计)  

undo亲和特性中已经新增了GRC object相关的视图，用户自定义对象亲和属性同样可以通过这些视图查询到亲和节点信息。

###   [4.6 安全性设计](#46-安全性设计)  

当前特性属于表、表分区对象能力的扩展，新增了语法分支，相关语法权限受对应语法的权限约束，不涉及其他相关的安全场景。

###   [4.7 兼容性设计](#47-兼容性设计)  

考虑支持所有支持的历史版本升级场景，需要在对应的upgrade升级目录下增加对应的系统表定义信息。

##   [5.需求分解](#5需求分解)  

|需求分解|SR范围|工作量（人周）|产品形态|
|---|---|---|---|
|集群支持表对象资源亲和|支持基本的表对象资源亲和语法以及对应的视图查询等，此SR包含升级能力|14|集群|
|集群支持分区对象资源亲和|扩展对象亲和支持范围到分区级力度，适配一级、二级分区|2|集群|
|主备集群支持对象资源亲和|扩展对象资源亲和能力到主备集群形态，重点在于备集群下的对象亲和的回放、访问、在线故障|4|集群|


##   [6.未来规划](#6未来规划)  

1. 与集群的多节点执行对接，让数据亲和的查询发生在数据亲和的节点。
1. 后续版本基于实际的客户诉求，决定是否要支持alter table/partition在线修改对象亲和属性。
1. 进一步演进为面向服务亲和的全局缓存管理，当亲和对象实例为当前实例时，当前实例访问本地资源可以采用gcs lock free的方式，性能近似单机。


## Attachments:

[create_table.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjA4OTcwYzJhZjRmNTIxYzhiIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.e_MaloUyXqkvAA1NUifLqyZusM4vO3Va9ThIeJuJjqI)

 (image/gif)    


[cluster_affinity.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjA4OTcwYzJhZjRmNTIxYzhlIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.-ui9adKXny8VIpqnzrCnflOqyzzmF5y0rRT_8Q5oFJ4)

 (image/png)    


[cluster_affinity.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjA4OTcwYzJhZjRmNTIxYzhmIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.8L3DnFT8TENdE_O_qlpopr5eNjuofkol-6PmCuX-5tk)

 (image/png)    


[cluster_affinity_structure.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjFhMWFkOWEzMzExZGM5YWZmIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.2s6GPpIiPqWXhqOmYR4TTcrhxqFUKw9ajBJr6Wh55H8)

 (image/png)    


[cluster_affinity_structure.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjFhMWFkOWEzMzExZGM5YjAwIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.glW8IBUDYrLL5a0MLomrrwROod3YDfI85Mt1vYWRV2Q)

 (image/png)    


[affinity_logical.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjFhMWFkOWEzMzExZGM5YjAyIiwicmVmX2lkIjoiNjczOTZlZjA3MjgyMDZlZmI5MmYyZWE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTIxLCJleHAiOjE3ODI1NDI5MjF9.1oidOZrt2ISzFSzA_0peVTPT6TjW9iV77ukDz8BXSnY)

 (image/png)    


## Comments:

|  [](null)  ,DRB评审意见：,用户指定实例亲和语法增加一种选择，通过指定实例名确定。,考虑后续基于TAC研究会话多实例透明转移，构建数据亲和计算的差异竞争力。    
  临时表具备天然的实例亲和性，对象资源亲和需要支持临时表。    
  GRC大锁未来有必要考虑做细化的partition，进一步降低热点冲突。    
  需要在概念手册中增加集群亲和性的材料，指导用户如何使用此能力。    
  对象缓冲区管理中，对象级checkpoint的引入对drop/truncate性能有影响，考虑后续做异步能力。,Posted by mengfanbin at 十一月 15, 2024 16:58|
|---|


