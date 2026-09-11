Created by 高风朴, last modified on 十月 15, 2024

*SR链接：*    [[YDBRD-29703] YFS 创建/删除/扩展文件性能优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29703)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

当前YAC在创建DB表空间时，会花费比较多的时间。而友商产品却能很快完成表空间的创建。YAC创建表空间需要扩展文件和对datafile格式化两步骤，发现扩展文件较耗时，因此我们需要对扩展文件和回收文件资源进行优化。目标性能超越RAC。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

客户现场要求：YAC创建表空间性能与友商一致，  甚至优于友商。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [友商性能比对报告---asm 创建删除文件性能 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147763423)  

  [YDBRD-29703 YFS 创建/删除/扩展文件性能优化 特性调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147780778)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

本次优化的均为已有接口

  [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

不涉及

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

优化扩展文件与回收文件资源性能

## 4.1 特性设计

![](https://pingcode.yasdb.com/atlas/files/public/67396ccb8970c2af4f520e5c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUNBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1NTcsImV4cCI6MTc4MjMxNDM1N30.XDO2UBPgnX9d_MC3oL_Ch5OzikKflCCEd7Mb3mM7IUk)

扩展文件：

优化前：扩展文件每个extent作为一个原子操作，原子结束需要将redo同步到备机，备机回放后返回。然后主机再刷盘等操作。

优化后：将优化前尽可能多的原子操作合并，合并成一个原子操作。减少了网络开销和磁盘io开销。

回收文件：

同扩展文件一样，放大了原子操作。

## 4.2 设计目标

根据调研结果。要求优化后，通过db创建表空间，删除表空间，性能与竞品持平，甚至超过竞品。

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

自测关注点：

1. 扩展尽可能大的文件，保证主备数据一致。不core
1. 设置立即回收模式，删除文件。不core。
1. 通过db创建表空间，性能优于竞品。（具体参考性能调研报告）


建议测试关注点：    
         1. 除了开发自测关注点，还需要关注主备同步过程故障，或者网络重试等。

       2. 性能测试，关注创建表空间，删除表空间

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,时间：2024.4.2 9:30~10：00,地点：腾讯会议,参会人：高风朴，吕雷奇,内容：测试串讲。,Posted by gaofengpu at 四月 02, 2024 10:14|
|---|
