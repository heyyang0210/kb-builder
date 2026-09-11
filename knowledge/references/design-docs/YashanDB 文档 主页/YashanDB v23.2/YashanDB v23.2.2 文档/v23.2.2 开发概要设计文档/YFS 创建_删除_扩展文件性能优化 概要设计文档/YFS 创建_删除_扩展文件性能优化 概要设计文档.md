Created by 高风朴, last modified on 十月 15, 2024

*SR链接：*    [[YDBRD-29703] YFS 创建/删除/扩展文件性能优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29703)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

当前YAC在创建DB表空间时，会花费比较多的时间。而友商产品却能很快完成表空间的创建。YAC创建表空间需要扩展文件和对datafile格式化两步骤，发现扩展文件较耗时，因此我们需要对扩展文件和回收文件资源进行优化。目标性能超越RAC。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [友商性能调研---asm 创建删除文件性能比对报告](/pages/createpage.action?spaceKey=YAS&title=%E5%8F%8B%E5%95%86%E6%80%A7%E8%83%BD%E8%B0%83%E7%A0%94---asm+%E5%88%9B%E5%BB%BA%E5%88%A0%E9%99%A4%E6%96%87%E4%BB%B6%E6%80%A7%E8%83%BD%E6%AF%94%E5%AF%B9%E6%8A%A5%E5%91%8A)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

不涉及

  [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

不涉及    [  
1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

不涉及

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

不涉及

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

  [YDBRD-29703 YFS 创建/删除/扩展文件性能优化 详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147776680)  

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

不涉及