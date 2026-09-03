Created by 徐凡博, last modified on 五月 18, 2024

**IR链接：**

  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b081)    **?**    
  **#YASHAN-305 YCS支持多盘，支持YFS管理YCS数据**

  


**关联SR：**

  [https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9](https://pingcode.yasdb.com/pjm/items/6611a8b5579a3edb84d860e9)    **?**    
  **#YDBRD-25869 YFS支持磁盘发现**

  [https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1](https://pingcode.yasdb.com/pjm/items/6611a8b7579a3edb84d860f1)    **?**    
  **#YDBRD-25870 YCS支持多盘——YCS**

  [https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9](https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9)    **?**    
  **#YDBRD-25871 YCS支持多盘——OM**

  [https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2](https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2)    **?**    
  **#YDBRD-26777 YCS支持单盘升级到多盘**

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

**IR描述：**

**需求来源：**   研发

**场 景：**   集群  将多盘放入yfs管理，且YCS的 voting disk和ycr disk支持多盘方案。

**需求描述：**     内部需求，提高集群产品对外竞争力。

**部署形态：**  集群

  


##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

简要概括为，YFS可以识别当前环境的所有可用磁盘，选择对应磁盘加入集群存储列表。而对于YCS模块来讲，不再独立管理voting disk、ycr disk，且不再直接读写磁盘，而是通过YFS来创建对应的存储区域，并使用YFS读写能力进行ycs、ycr文件的操作。

本需求会影响集群相关的以下场景及相关功能：

|属性|场景名称|关键技术点|特性是否涉及|测试关键点|
|---|---|---|---|---|
|部署|yfs磁盘发现能力|是|是|YFS模块识别当前环境所有可用磁盘，提供挑选磁盘能力，可展示相关视图。|
|  
|yfs读写ycs、ycr文件能力|是|是|为YCS模块提供读写YCS、YCR文件的能力，YCS模块无需再调用底层读写接口进行盘操作。|
|  
|ycr获取ycs、ycr文件名称的能力|是|是|创建YCS模块相关DG及文件，并且提供相关视图查询文件特性。|
|启动ycs|ycs启动能力|是|是|YCS启动时，不再读盘，而读写相关YFS文件进行启动操作，注意此处有相关参数的修改。|
|停止ycs|ycs停止能力|是|是|停止YCS时，需要写入相应元数据至YFS，因此YFS服务不能在YCS写完数据之前全部停止。|
|投票|利用多盘投票的能力|是|是|读写voting disk进行投票的流程，需要修改为读写相关YFS文件。注意此部分关系到多副本问题，  最终数据有效时采用多数派还是全部有效？？？|
|ycsdump工具|ycsdump展示多盘存储情况|是|是|ycsdump工具需要根据多盘的表现进行数据陈列的调整。|
|升级能力|从单盘升级到多盘的能力|是|是|提供由当前单盘模式升级到多盘的能力。|
|多盘状态的topo展示|ycsctl能够展示多块盘的状态（离线、在线）|是|是|ycsctl呈现多盘状态（影响到多副本的可用性）|
|om安装部署|om适配部署流程|是|是|yasboot必须兼容新的部署形式。|
|om升级|om适配升级流程|是|是|yasboot也可以实现相关的升级。|


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1）兼容原来的模式——裸盘，裸盘模式不支持多盘，不会放在yfs管理     – 裸盘不支持那支持的是什么类型？

2）支持配置1、3、5块磁盘，其他数量不支持

3）(VF盘数/2 )+ 1 或者以上的数量的文件副本损坏时，集群启动失败

4）不支持增加或者删除disk和文件副本

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

### **4.1 主要应用场景如下：**

1、充分利用YFS的冗余和条带化特征，为voting file等YCS重要元数据提供冗余保护，避免单盘读写故障导致的集群重构。

2、方便集群系统的演进，适应市场变化，提供更稳定的架构。

### 4.2 友商调研（来自开发文档）

ASM支持OCR和VF调研文档       [ASM支持OCR和VF调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147770440)  

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

#### 1、测试设计整体思路

本需求涉及到对已有功能的变更，新功能的扩展，注意识别新特性与旧系统之间的差异点和共同点，原则上新的需求方案需兼容并优于已有功能。

1）本需求涉及到对基础设施的架构调整，会影响到集群现有的硬件设施布局以及集群部署流程的变更，这部分影响面很广，需协调工程部提供相应硬件设施、变更所有测试框架的部署脚本，尤其注意上车后对已有CI工程的影响。

2）硬件设施变更与磁盘发现功能相关性强，可在磁盘发现需求中识别对应磁盘，同时根据磁盘进行YCS单独DG的创建和文件的创建，这部分为本需求新增功能，且为基底，需重点针对性地测试。

3）YCS对底层盘读写的变更，变成使用YFS的读写能力进行相关数据的读写，影响到涉及YCS模块盘读写的所有功能，例如YCS启停能力、投票选举能力等，这部分原则上不影响已有功能，需识别是否增加新的场景针对性测试。

4）关于盘相关工具，已有ycsdump工具对盘内容的展示，会受到一定程度的影响，同时ycsctl工具需提供查询盘状态的topo，此部分为新增功能，需补充对应场景进行测试。

5）OM部署功能，时间点上需基于上述功能实现之后，可考虑优先从内部功能开始，到OM兼容后，分阶段进行相应功能测试，最终以用户常用手段进行集群的部署。

6）单盘到多盘功能的升级，本功能对属于用户友好型功能，通过升级功能无缝切换版本，本部分为该需求后期功能，同时涉及到OM部分的兼容，需从功能兼容性、用户友好性等方面考虑测试场景。

7）对于YCS投票文件voting file，由于多盘功能的实现，会有多副本的冗余特性，副本根据盘数目可选（目前支持1、3、5），因此需要考虑副本有效性对其他功能，尤其是启动功能的影响，本部分需要针对性做可靠性的测试。

#### 2、关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明

1）测试方法说明

a)  针对部署流程层面的测试，主要采用场景法、状态转换法进行测试设计。

b) 针对多盘多副本的测试，主要采用组合法、错误推断法进行测试设计。

c) 对于新增视图、拓扑等的测试，主要采用场景法进行测试设计。

  


2）设计的测试框架说明

所有集群部署框架均需要修改变更，包括guider、HA、CT、KT等。yasboot也需做相应变更。

  


3) 用例自动化

a) 当前大多数测试框架已兼容yasboot，所以自动化需依赖yasboot。

b) yfs模块需考虑是否增加Guider入口，以兼容磁盘发现等功能测试。

c) YCS模块YCR相关guider接口是否需要进行变化，需根据具体方案进行变更。

d) 原则上，启停等已有功能可通过已有自动化进行功能测试。

e)关于并发、故障场景，考虑HA框架实现。

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

本SR主要涉及YFS对YCS管理数据的读写以及YCS管理功能的变更，原则上不影响数据库数据的读写。

不涉及：性能、高可用、CT、KT、一致性、长稳、安全性、压力

涉及：可维护性、可测试性、升级、DFR。

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

测试覆盖策略：场景法、错误推测法是主测试方法。

自动化看护策略：所有集群测试框架的部署脚本看护部署功能、其他Guider、HA框架看护针对性功能。

框架满足度：提前规划硬件设施变更、框架部署、Guider框架@clusterTool yfs接口的新增、@clusterTool ycr接口的变更。

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*