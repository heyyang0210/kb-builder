*SR链接：*  [https://pingcode.yasdb.com/pjm/items/670498a3e489dd0868f1776b](https://pingcode.yasdb.com/pjm/items/670498a3e489dd0868f1776b)  *?*    
  *#YDBRD-33400 YFS支持AU粒度条带化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

YFS计划支持条带化，提升读写性能。ASM作为老牌产品。功能健全，性能优越，对我们建设和丰富自己的产品，有极高的参考价值。

###   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  [YFS条带化产品行为定义 - 产品部 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147780227)  

###   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

|属性|场景名称|需求调研|关键技术点|特性是否涉及|逆向工程|
|:---|:---|:---|:---|:---|:---|
|功能|参数|_ASM_STRIPESIZE，_ASM_STRIPEWIDTH|是/否|是/否|是否可提取友商的实现方案|
|  
|FAT|条带化后FAT分配回收|是/否|是/否|是否可提取友商的实现方案|
|  
|粗细粒度|粗粒度不可调和细粒度可调|  
|  
|  
|


ASM条带类型分为细粒度（fine-grained strpping）可调和粗粒度不可调（Coarse-Grained Striping）两种。可调的意思是条带size是否可调整。

#### 1.2.1 细粒度：

细粒度大小默认128k（_ASM_STRIPESIZE）。宽度默认值8（_ASM_STRIPEWIDTH）。也就是说文件被分为128K一个chunk。分布在各个AU中。如下图所示：

![image.png](https://pingcode.yasdb.com/atlas/files/public/675794f0a1ad9a3311de4571/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFBQVFDQWNJUUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFCQUFBQUFBQUFBQUFCQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwNDIsImV4cCI6MTc4MjQ2Njg0Mn0.o7mSY9i9aHnxQbFlRxs_XzaMFG_o8n_klCnUaKyZoNI)

上面是一个AU大小为1M，diskgroup内磁盘有8块，无镜像。_ASM_STRIPESIZE=182k，_ASM_STRIPEWIDTH=8. 的一个分配场景。可见，一个文件被按照128一个chunk，分为AB。。各个chunk

chunk A被放在1号盘，chunB被放在2号盘。。。。

#### 1.2.2 粗粒度：

粗粒度条带size等于AU。文件按照一个au大小作为一个chunk。如下图所示：

![image.png](https://pingcode.yasdb.com/atlas/files/public/67579519a1ad9a3311de4573/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFBQVFDQWNJUUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFCQUFBQUFBQUFBQUFCQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwNDIsImV4cCI6MTc4MjQ2Njg0Mn0.o7mSY9i9aHnxQbFlRxs_XzaMFG_o8n_klCnUaKyZoNI)

上面是一个AU大小为1M，diskgroup内磁盘有8块，无镜像。_ASM_STRIPESIZE=182k，_ASM_STRIPEWIDTH=8. 的一个分配场景

该图中展示了extent为1和extent为4两种情况下, 数据如何被条带化：  
extent=1  chunk A被放在1号盘，chunk B被放在2号盘。

extent=4， chunk A被放在1号盘，chunk B被放在2号盘。（  这里目前与yfs实现有差异  ）

#### 1.2.3 _ASM_STRIPESIZE，_ASM_STRIPEWIDTH：

_ASM_STRIPESIZE：条带size，隐藏参数，大小需要被1M整除。默认值128K，可以通过alter system set “_asm_stripesize=xxxx”设置

_ASM_STRIPEWIDTH：条带宽度，隐藏参数。整数。默认值8. 可以通过alter system set “_asm_stripewidth=xxxx”设置

##### 1.2.3.1 参数对FAT的影响：

细粒度下，这两个参数对FAT影响如下：

1.2.3.1.1 如果磁盘数为1，则细粒度条带也是按照放满第一个AU再放第二个AU顺序存放

1.2.3.1.2 如果磁盘数大于1小于条带宽度，则会按照磁盘数进行交叉循环存放，第一个条带尺寸128k存放于第一个磁盘的AU1，第二个条带尺寸存放于第二块磁盘的AU2，当AU放满，会再次分配新的extent以及对应AU。

![image.png](https://pingcode.yasdb.com/atlas/files/public/6757954aa1ad9a3311de4575/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFBQVFDQWNJUUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFCQUFBQUFBQUFBQUFCQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwNDIsImV4cCI6MTc4MjQ2Njg0Mn0.o7mSY9i9aHnxQbFlRxs_XzaMFG_o8n_klCnUaKyZoNI)

上图所示，stripsize=512，stripwidth=4，大于磁盘个数2， au=1M，无镜像场景下数据分布。

  
1.2.3.1.3 如果磁盘数大于条带宽度，则会根据条带宽度进行在不同磁盘间存放，当第一组AU存放满之后，由于ASM磁盘要均匀存放数据在磁盘组所有磁盘，所以会根据算法再使用其他未放置数据磁盘，循环往复，直到所有数据都均匀分布在磁盘组所有磁盘。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67579562a1ad9a3311de4576/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQUFBQVFDQWNJUUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFCQUFBQUFBQUFBQUFCQWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwNDIsImV4cCI6MTc4MjQ2Njg0Mn0.o7mSY9i9aHnxQbFlRxs_XzaMFG_o8n_klCnUaKyZoNI)

上图所示，stripsize=512，stripwidth=2，小于磁盘个数4，au=1M，无镜像场景下数据分布。

#### 1.2.4 文件条带化设置

默认情况下，  oracle rac仅ctrlfile是细粒度  。其他文件都是粗粒度。

asm有一系列模版，可以创建新的模版。并在创建文件时指定模版。

alter diskgroup dg1 add template   stripe_fine2   attributes（fine）；

create tablespace tbs_tbtest datafile “+dg1(  stripe_fine2   )/tbs_data01.dbf”  size 100m;  

11g默认参数值如下：
_asm_stripesize 131072即128KB，
_asm_stripewidth 8为例，
数据存放不止与条带宽度有关，还与ASM DISKGROUP中磁盘数有关，下面均以磁盘组external冗余为例
经过不同磁盘数测试得出情况如下：

如果磁盘数为1，则细粒度条带也是按照放满第一个AU再放第二个AU顺序存放，可以通过dd验证这种情况。  
如果磁盘数大于1小于条带宽度，则会按照磁盘数进行交叉循环存放，第一个条带尺寸128k存放于第一个磁盘的AU1，第二个条带尺寸存放于第二块磁盘的AU2，当AU放满，会再次分配新的extent以及对应AU。
如果磁盘数大于条带宽度，则会根据条带宽度进行在不同磁盘间存放，当第一组AU存放满之后，由于ASM磁盘要均匀存放数据在磁盘组所有磁盘，所以会根据算法再使用其他未放置数据磁盘，循环往复，直到所有数据都均匀分布在磁盘组所有磁盘。



###   [1.3 达梦情况调研](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

11.3.4 条带化

ASM 文件条带化技术是将一块连续的数据按照条带化粒度分割成多个数据块，并把它们分别存储到不同的磁盘中。

条带化分为两种类型：粗粒度条带化和细粒度条带化。条带化粒度是执行条带化的重要参数，取值 0、32、64、128 和 256，单位 KB。



数据文件的条带化粒度通过 DMINIT.INI 文件的 DATA_STRIPING 参数进行配置。

控制文件的条带化粒度固定为粗粒度，无需用户指定。

联机日志的条带化粒度通过 DMINIT.INI 文件的 LOG_STRIPING 参数进行配置。

归档日志的条带化粒度通过 DMARCH.INI 文件的 ARCH_ASM_STRIPING 参数进行配置。

ASM 文件的条带化粒度在创建 ASM 文件时指定。

IOTEST 临时文件的条带化粒度在执行 IOTEST 命令测试 ASM 环境下磁盘读写速度时指定。

条带化粒度取值 0 表示粗粒度。粗粒度条带是将文件按 AU 大小分割为一个个数据块。下图展示了粗粒度条带化分割示意图，其中以 AU 大小 1MB，文件大小 3MB 为例，文件被分为 3 个块，3 个块均匀地分布在磁盘组的三个磁盘上。



###   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

不涉及

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明调研特性对外的功能规格或约束。给出各友商的差异点、优缺点描述。**

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。