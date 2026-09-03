Created by 程康, last modified on 十一月 06, 2024

select current_timestamp(6), truncate(current_timestamp(6), 7);

select current_timestamp(5), truncate(current_timestamp(5), 7);

select current_timestamp(4), truncate(current_timestamp(4), 7);

select current_timestamp(3), truncate(current_timestamp(3), 7);

select current_timestamp(2), truncate(current_timestamp(2), 7);

select current_timestamp(1), truncate(current_timestamp(1), 7);

select current_timestamp(), truncate(current_timestamp(), 7);

  


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a48970c2af4f53a73b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MzcsImV4cCI6MTc4MjQ2NjIzN30.WgEUXGARZQOJ3bRCEtsfyvg1cdJFFjMVyHs8AfS7r_0)

  


最多截取到小数点后三位

  


--yashan

  


select systimestamp, truncate(systimestamp,7);

  


  


|  
|mysql|yashan|  
|
|---|---|---|---|
|date|curdate()|current_date,sysdate|  
|
|time|curtime()|cast(sysdate as time)|  
|
|timestamp|current_timestamp()|systimestamp|  
|


  


  


  


  


  


## Attachments: