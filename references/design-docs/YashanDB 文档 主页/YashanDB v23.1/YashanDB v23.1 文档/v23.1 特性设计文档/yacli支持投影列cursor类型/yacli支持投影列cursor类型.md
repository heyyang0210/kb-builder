Created by 侯忠林, last modified on 七月 17, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

C驱动支持cursor类型目前已经支持出参入参，此次需要支持cursor的fetch，即ResultSet结果集支持获取cursor类型数据。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持cursor类型

如果fetch的类型是cursor，则只支持绑定YAC_SQLT_CURSOR类型，  类型为YacHandle，对应  stmt。在f  etch以后  ，可以对YacHandle在进行fetch，拿到cursor对应的结果集信息。

YacHandle后续需要用户自己手动释放。目前只能绑定YacHandle，绑定其他的则会异常。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

cursor投影列数量限制（4096是投影列的限制）

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

fetch 数据如果是cursor类型，则通过解析拿到cursor的id，通过当前conn创建一个stmt,用stmt请求fetch cursor的数据，最终返回ResultSet结果集。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.支持select cursor并校验结果正确

2.支持select 多个cursor

3.支持select cursor中有嵌套cursor

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量100，2天。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*