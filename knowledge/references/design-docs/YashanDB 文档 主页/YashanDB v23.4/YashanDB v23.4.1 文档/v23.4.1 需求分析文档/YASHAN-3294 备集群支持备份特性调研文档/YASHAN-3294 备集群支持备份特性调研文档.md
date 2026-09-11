Created by 张旭涛 on 十一月 15, 2024



*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66d98ebc89f961f33010b187](https://pingcode.yasdb.com/ship/ideas/66d98ebc89f961f33010b187)  *?*    
  *#YASHAN-3294 备集群支持备份*

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8](https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8)  *?*    
  *#YDBRD-33780 备集群支持备份*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

  [https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8](https://pingcode.yasdb.com/pjm/items/6707483ee489dd0868f383c8)  ?  
#YDBRD-33780 备集群支持备份

###   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

合理，相比主集群备份，有性能提升。



###   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

**去掉备集群备份拦截。优化函数处理逻辑。**

**yashan数据库实现与友商实现不同，无需参考调研。**



###   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**无**



###   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#2-%E6%8E%A5%E5%8F%A3)  

已在单机实现。



##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**无**

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

