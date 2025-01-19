from abc import ABC, abstractmethod

from classes.new_product import NewProduct
from classes.update_product import UpdateProduct


class SpiderInterface(ABC):
    INFO: dict

    @abstractmethod
    async def run(self, paths: list[str]) -> tuple[list[UpdateProduct], list[NewProduct], list[NewProduct]]:
        pass